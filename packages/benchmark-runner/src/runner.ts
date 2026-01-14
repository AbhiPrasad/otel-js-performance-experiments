import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AutocannonBenchmark, BENCHMARK_PRESETS } from './autocannon-wrapper.js';
import { ClinicWrapper } from './clinic-wrapper.js';
import type {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkPreset,
  ClinicConfig,
  ClinicResult,
  ServerProcess,
} from './types.js';

export interface RunConfig {
  app: 'express' | 'fastify';
  appPath: string;
  scenario: {
    name: string;
    endpoint: string;
    method: 'GET' | 'POST';
    body?: object;
  };
  instrumentationMode: {
    name: string;
    envVars: Record<string, string>;
  };
  preset: keyof typeof BENCHMARK_PRESETS | BenchmarkPreset;
  port?: number;
  clinic?: 'doctor' | 'flame' | 'bubbleprof';
  clinicOutputDir?: string;
}

export interface RunResult {
  config: {
    app: string;
    scenario: string;
    mode: string;
    connections: number;
    duration: number;
  };
  benchmarkResults: BenchmarkResult;
  clinicResults?: ClinicResult;
}

export class BenchmarkRunner extends EventEmitter {
  private serverProcess: ChildProcess | null = null;

  async run(config: RunConfig): Promise<RunResult> {
    const port = config.port || 3000;
    const preset =
      typeof config.preset === 'string' ? BENCHMARK_PRESETS[config.preset] : config.preset;

    this.emit('phase', 'starting');
    this.emit('test', `${config.app} - ${config.scenario.name} - ${config.instrumentationMode.name}`);

    let benchmarkResults: BenchmarkResult;
    let clinicResults: ClinicResult | undefined;

    if (config.clinic) {
      // Run with clinic profiling
      const clinicConfig: ClinicConfig = {
        tool: config.clinic,
        outputDir: config.clinicOutputDir || './results/clinic-reports',
        serverScript: `${config.appPath}/dist/index.js`,
        env: {
          ...config.instrumentationMode.envVars,
          PORT: String(port),
        },
      };

      // Add --import flag for OTel instrumentation
      if (config.instrumentationMode.envVars.OTEL_ENABLED === 'true') {
        clinicConfig.serverArgs = [
          '--import',
          `${config.appPath}/dist/instrumentation/otel-tracing.js`,
        ];
      }

      const clinic = new ClinicWrapper(clinicConfig);

      this.emit('phase', 'profiling');

      clinicResults = await clinic.profile(async (serverPort) => {
        const benchmark = new AutocannonBenchmark({
          url: `http://localhost:${serverPort}${config.scenario.endpoint}`,
          method: config.scenario.method,
          body: config.scenario.body ? JSON.stringify(config.scenario.body) : undefined,
          headers: config.scenario.body ? { 'Content-Type': 'application/json' } : undefined,
          ...preset,
        });

        benchmark.on('warmup:start', () => this.emit('phase', 'warmup'));
        benchmark.on('benchmark:start', () => this.emit('phase', 'benchmarking'));
        benchmark.on('benchmark:tick', () => this.emit('tick'));

        benchmarkResults = await benchmark.run();
      }, port);
    } else {
      // Run without clinic - start server manually
      const server = await this.startServer(config, port);

      try {
        const benchmark = new AutocannonBenchmark({
          url: `http://localhost:${port}${config.scenario.endpoint}`,
          method: config.scenario.method,
          body: config.scenario.body ? JSON.stringify(config.scenario.body) : undefined,
          headers: config.scenario.body ? { 'Content-Type': 'application/json' } : undefined,
          ...preset,
        });

        benchmark.on('warmup:start', () => this.emit('phase', 'warmup'));
        benchmark.on('benchmark:start', () => this.emit('phase', 'benchmarking'));
        benchmark.on('benchmark:tick', () => this.emit('tick'));

        benchmarkResults = await benchmark.run();
      } finally {
        await server.kill();
      }
    }

    this.emit('phase', 'complete');

    return {
      config: {
        app: config.app,
        scenario: config.scenario.name,
        mode: config.instrumentationMode.name,
        connections: preset.connections,
        duration: preset.duration,
      },
      benchmarkResults: benchmarkResults!,
      clinicResults,
    };
  }

  private async startServer(config: RunConfig, port: number): Promise<ServerProcess> {
    return new Promise((resolve, reject) => {
      const args: string[] = [];

      // Add --import flag for OTel instrumentation
      if (config.instrumentationMode.envVars.OTEL_ENABLED === 'true') {
        args.push('--import', `${config.appPath}/dist/instrumentation/otel-tracing.js`);
      }

      args.push(`${config.appPath}/dist/index.js`);

      const serverProcess = spawn('node', args, {
        env: {
          ...process.env,
          ...config.instrumentationMode.envVars,
          PORT: String(port),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.serverProcess = serverProcess;

      let started = false;

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (!started && (output.includes('listening') || output.includes(`port ${port}`))) {
          started = true;
          // Give the server a moment to fully initialize
          setTimeout(() => {
            resolve({
              port,
              pid: serverProcess.pid!,
              kill: async () => {
                return new Promise((res) => {
                  serverProcess.on('close', () => res());
                  serverProcess.kill('SIGTERM');
                  // Force kill after timeout
                  setTimeout(() => {
                    if (!serverProcess.killed) {
                      serverProcess.kill('SIGKILL');
                    }
                    res();
                  }, 5000);
                });
              },
            });
          }, 500);
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error(`Server stderr: ${data}`);
      });

      serverProcess.on('error', (err) => {
        reject(err);
      });

      serverProcess.on('close', (code) => {
        if (!started) {
          reject(new Error(`Server exited with code ${code} before starting`));
        }
      });

      // Timeout if server doesn't start
      setTimeout(() => {
        if (!started) {
          serverProcess.kill('SIGKILL');
          reject(new Error('Server failed to start within timeout'));
        }
      }, 30000);
    });
  }

  async cleanup(): Promise<void> {
    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.kill('SIGKILL');
    }
  }
}

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import type { ClinicConfig, ClinicResult } from './types.js';

export class ClinicWrapper {
  private config: ClinicConfig;

  constructor(config: ClinicConfig) {
    this.config = config;
  }

  /**
   * Run clinic profiling with a custom load function
   * This starts the server via clinic, runs the load test, then generates reports
   */
  async profile(
    loadTestFn: (port: number) => Promise<void>,
    port: number = 3000
  ): Promise<ClinicResult> {
    const { tool, outputDir, serverScript, serverArgs = [], env = {} } = this.config;

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      // Build clinic command
      const clinicArgs = [
        'clinic',
        tool,
        '--dest',
        outputDir,
        '--',
        'node',
        serverScript,
        ...serverArgs,
      ];

      const clinicProcess = spawn('npx', clinicArgs, {
        cwd: path.dirname(serverScript),
        env: { ...process.env, ...env, PORT: String(port) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      clinicProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Check if server is ready
        if (stdout.includes('listening on port') || stdout.includes(`port ${port}`)) {
          // Server is ready, start load test
          setTimeout(async () => {
            try {
              await loadTestFn(port);
              // Send SIGINT to stop profiling and generate report
              clinicProcess.kill('SIGINT');
            } catch (err) {
              clinicProcess.kill('SIGKILL');
              reject(err);
            }
          }, 1000);
        }
      });

      clinicProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      clinicProcess.on('close', async (code) => {
        if (code !== 0 && code !== null) {
          // Code 130 is SIGINT, which is expected
          if (code !== 130) {
            reject(new Error(`Clinic ${tool} failed with code ${code}: ${stderr}`));
            return;
          }
        }

        // Find the generated report
        const reportPath = await this.findLatestReport(outputDir, tool);

        resolve({
          tool,
          htmlReportPath: reportPath,
          dataPath: outputDir,
          recommendations: this.parseRecommendations(stdout, tool),
        });
      });
    });
  }

  /**
   * Run clinic without a load test function - just generate a flamegraph
   * Use this when you want to run the load test separately
   */
  async profileWithAutoLoad(autocannonDuration: number = 30): Promise<ClinicResult> {
    const { tool, outputDir, serverScript, serverArgs = [], env = {} } = this.config;

    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      // Build clinic command with built-in autocannon
      const clinicArgs = [
        'clinic',
        tool,
        '--dest',
        outputDir,
        '--on-port',
        `autocannon -d ${autocannonDuration} http://localhost:\\$PORT/api/simple`,
        '--',
        'node',
        serverScript,
        ...serverArgs,
      ];

      const clinicProcess = spawn('npx', clinicArgs, {
        cwd: path.dirname(serverScript),
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      clinicProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      clinicProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      clinicProcess.on('close', async (code) => {
        if (code !== 0 && code !== null && code !== 130) {
          reject(new Error(`Clinic ${tool} failed with code ${code}: ${stderr}`));
          return;
        }

        const reportPath = await this.findLatestReport(outputDir, tool);

        resolve({
          tool,
          htmlReportPath: reportPath,
          dataPath: outputDir,
          recommendations: this.parseRecommendations(stdout, tool),
        });
      });
    });
  }

  private async findLatestReport(dir: string, tool: string): Promise<string> {
    try {
      const files = await fs.readdir(dir);
      const htmlFiles = files.filter((f) => f.endsWith('.html') && f.includes(tool));

      if (htmlFiles.length === 0) {
        // Look for clinic-generated directories
        const clinicDirs = files.filter((f) => f.includes('.clinic'));
        if (clinicDirs.length > 0) {
          return path.join(dir, clinicDirs[clinicDirs.length - 1]);
        }
        return path.join(dir, `${tool}-report.html`);
      }

      // Return the most recent file
      htmlFiles.sort();
      return path.join(dir, htmlFiles[htmlFiles.length - 1]);
    } catch {
      return path.join(dir, `${tool}-report.html`);
    }
  }

  private parseRecommendations(output: string, tool: string): string[] {
    if (tool !== 'doctor') return [];

    const recommendations: string[] = [];

    if (output.includes('I/O')) {
      recommendations.push('High I/O activity detected - consider using clinic bubbleprof');
    }
    if (output.includes('CPU')) {
      recommendations.push('High CPU usage detected - consider using clinic flame');
    }
    if (output.includes('Event Loop') || output.includes('event loop')) {
      recommendations.push('Event loop delays detected - review async operations');
    }
    if (output.includes('memory')) {
      recommendations.push('Memory issues detected - consider using clinic heapprofiler');
    }

    return recommendations;
  }
}

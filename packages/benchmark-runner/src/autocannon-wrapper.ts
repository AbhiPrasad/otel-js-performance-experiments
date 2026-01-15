import autocannon, { Result } from 'autocannon';
import { EventEmitter } from 'events';
import type { BenchmarkConfig, BenchmarkResult, BenchmarkEventType } from './types.js';

// Re-export from shared config for backwards compatibility
export { BENCHMARK_PRESETS } from '@otel-perf/config';

export const DEFAULT_CONFIG: Partial<BenchmarkConfig> = {
  connections: 10,
  pipelining: 1,
  duration: 30,
  warmup: {
    duration: 5,
    connections: 5,
  },
};

export class AutocannonBenchmark extends EventEmitter {
  private config: Required<BenchmarkConfig>;

  constructor(config: BenchmarkConfig) {
    super();
    this.config = {
      method: 'GET',
      body: '',
      headers: {},
      ...DEFAULT_CONFIG,
      ...config,
      warmup: {
        ...DEFAULT_CONFIG.warmup!,
        ...config.warmup,
      },
    } as Required<BenchmarkConfig>;
  }

  override emit(event: BenchmarkEventType, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  override on(event: BenchmarkEventType, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  async warmup(): Promise<void> {
    if (!this.config.warmup) return;

    this.emit('warmup:start');

    await new Promise<void>((resolve, reject) => {
      autocannon(
        {
          url: this.config.url,
          connections: this.config.warmup.connections,
          duration: this.config.warmup.duration,
          method: this.config.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
          body: this.config.body || undefined,
          headers: this.config.headers,
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    this.emit('warmup:complete');

    // Short pause after warmup
    await new Promise((r) => setTimeout(r, 1000));
  }

  async run(): Promise<BenchmarkResult> {
    // Warmup first
    await this.warmup();

    this.emit('benchmark:start');

    return new Promise((resolve, reject) => {
      const instance = autocannon(
        {
          url: this.config.url,
          connections: this.config.connections,
          pipelining: this.config.pipelining,
          duration: this.config.duration,
          method: this.config.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
          body: this.config.body || undefined,
          headers: this.config.headers,
        },
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }

          const benchmarkResult = this.parseResult(result);
          this.emit('benchmark:complete', benchmarkResult);
          resolve(benchmarkResult);
        }
      );

      // Progress events
      instance.on('tick', () => {
        this.emit('benchmark:tick');
      });
    });
  }

  private parseResult(result: Result): BenchmarkResult {
    return {
      totalRequests: result.requests.total,
      requestsPerSecond: {
        mean: result.requests.mean,
        stddev: result.requests.stddev,
        min: result.requests.min,
        max: result.requests.max,
        p50: result.requests.p50 || result.requests.mean,
        p90: result.requests.p90 || result.requests.mean,
        p99: result.requests.p99 || result.requests.mean,
      },
      latency: {
        mean: result.latency.mean,
        stddev: result.latency.stddev,
        min: result.latency.min,
        max: result.latency.max,
        p50: result.latency.p50,
        p90: result.latency.p90,
        p99: result.latency.p99,
      },
      throughput: {
        mean: result.throughput.mean,
        stddev: result.throughput.stddev,
        min: result.throughput.min,
        max: result.throughput.max,
      },
      errors: result.errors,
      timeouts: result.timeouts,
      duration: result.duration,
      connections: result.connections,
      pipelining: result.pipelining,
    };
  }
}


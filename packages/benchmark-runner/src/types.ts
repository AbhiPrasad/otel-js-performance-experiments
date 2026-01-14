export interface BenchmarkConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
  headers?: Record<string, string>;
  connections?: number;
  pipelining?: number;
  duration?: number;
  warmup?: {
    duration: number;
    connections: number;
  };
}

export interface LatencyStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p99: number;
}

export interface ThroughputStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

export interface BenchmarkResult {
  totalRequests: number;
  requestsPerSecond: LatencyStats;
  latency: LatencyStats;
  throughput: ThroughputStats;
  errors: number;
  timeouts: number;
  duration: number;
  connections: number;
  pipelining: number;
}

export interface BenchmarkPreset {
  connections: number;
  duration: number;
  pipelining: number;
  warmup: {
    duration: number;
    connections: number;
  };
}

export interface ClinicConfig {
  tool: 'doctor' | 'flame' | 'bubbleprof' | 'heapprofiler';
  outputDir: string;
  serverScript: string;
  serverArgs?: string[];
  env?: Record<string, string>;
}

export interface ClinicResult {
  tool: string;
  htmlReportPath: string;
  dataPath: string;
  recommendations?: string[];
}

export type BenchmarkEventType =
  | 'warmup:start'
  | 'warmup:complete'
  | 'benchmark:start'
  | 'benchmark:tick'
  | 'benchmark:complete';

export interface ServerProcess {
  port: number;
  pid: number;
  kill: () => Promise<void>;
}

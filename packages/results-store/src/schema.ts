export interface BenchmarkMetadata {
  id: string;
  label: string;
  timestamp: string;

  git: {
    branch: string;
    commit: string;
    shortCommit: string;
    commitMessage: string;
    commitDate: string;
    isPR?: boolean;
    prNumber?: number;
    tag?: string;
  };

  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCores: number;
    totalMemory: number;
  };

  config: {
    app: string;
    scenario: string;
    mode: string;
    connections: number;
    duration: number;
    pipelining: number;
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

export interface BenchmarkResults {
  autocannon: {
    requestsPerSecond: LatencyStats;
    latency: LatencyStats;
    throughput: ThroughputStats;
    totalRequests: number;
    errors: number;
    timeouts: number;
  };

  resources?: {
    cpu: {
      mean: number;
      max: number;
    };
    memory: {
      heapUsedMean: number;
      heapUsedMax: number;
      rssMean: number;
      rssMax: number;
    };
    eventLoopDelay?: {
      mean: number;
      max: number;
      p99: number;
    };
  };

  clinicReports?: {
    doctor?: string;
    flame?: string;
    bubbleprof?: string;
  };
}

export interface StoredBenchmark {
  metadata: BenchmarkMetadata;
  results: BenchmarkResults;
}

export interface MetricDiff {
  absolute: number;
  percentage: number;
  improved: boolean;
}

export interface ComparisonResult {
  baseline: StoredBenchmark;
  target: StoredBenchmark;

  diff: {
    requestsPerSecond: MetricDiff;
    latencyP50: MetricDiff;
    latencyP99: MetricDiff;
    throughput: MetricDiff;
    errors: {
      absolute: number;
      improved: boolean;
    };
  };

  summary: 'improved' | 'regressed' | 'neutral';
  significantChanges: string[];
}

export interface IndexEntry {
  id: string;
  label: string;
  timestamp: string;
  filepath: string;
  app: string;
  scenario: string;
  mode: string;
  git: {
    branch: string;
    commit: string;
    tag?: string;
  };
}

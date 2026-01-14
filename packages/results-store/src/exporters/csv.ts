import type { StoredBenchmark, ComparisonResult } from '../schema.js';

export function exportBenchmarkToCsv(benchmark: StoredBenchmark): string {
  const headers = [
    'label',
    'timestamp',
    'app',
    'scenario',
    'mode',
    'git_branch',
    'git_commit',
    'connections',
    'duration',
    'requests_per_sec_mean',
    'requests_per_sec_p50',
    'requests_per_sec_p99',
    'latency_mean_ms',
    'latency_p50_ms',
    'latency_p99_ms',
    'throughput_mean',
    'errors',
    'timeouts',
  ];

  const values = [
    benchmark.metadata.label,
    benchmark.metadata.timestamp,
    benchmark.metadata.config.app,
    benchmark.metadata.config.scenario,
    benchmark.metadata.config.mode,
    benchmark.metadata.git.branch,
    benchmark.metadata.git.shortCommit,
    benchmark.metadata.config.connections,
    benchmark.metadata.config.duration,
    benchmark.results.autocannon.requestsPerSecond.mean.toFixed(2),
    benchmark.results.autocannon.requestsPerSecond.p50.toFixed(2),
    benchmark.results.autocannon.requestsPerSecond.p99.toFixed(2),
    benchmark.results.autocannon.latency.mean.toFixed(2),
    benchmark.results.autocannon.latency.p50.toFixed(2),
    benchmark.results.autocannon.latency.p99.toFixed(2),
    benchmark.results.autocannon.throughput.mean.toFixed(2),
    benchmark.results.autocannon.errors,
    benchmark.results.autocannon.timeouts,
  ];

  return [headers.join(','), values.join(',')].join('\n');
}

export function exportBenchmarksToCsv(benchmarks: StoredBenchmark[]): string {
  const headers = [
    'label',
    'timestamp',
    'app',
    'scenario',
    'mode',
    'git_branch',
    'git_commit',
    'connections',
    'duration',
    'requests_per_sec_mean',
    'requests_per_sec_p50',
    'requests_per_sec_p99',
    'latency_mean_ms',
    'latency_p50_ms',
    'latency_p99_ms',
    'throughput_mean',
    'errors',
    'timeouts',
  ];

  const rows = benchmarks.map((b) => [
    b.metadata.label,
    b.metadata.timestamp,
    b.metadata.config.app,
    b.metadata.config.scenario,
    b.metadata.config.mode,
    b.metadata.git.branch,
    b.metadata.git.shortCommit,
    b.metadata.config.connections,
    b.metadata.config.duration,
    b.results.autocannon.requestsPerSecond.mean.toFixed(2),
    b.results.autocannon.requestsPerSecond.p50.toFixed(2),
    b.results.autocannon.requestsPerSecond.p99.toFixed(2),
    b.results.autocannon.latency.mean.toFixed(2),
    b.results.autocannon.latency.p50.toFixed(2),
    b.results.autocannon.latency.p99.toFixed(2),
    b.results.autocannon.throughput.mean.toFixed(2),
    b.results.autocannon.errors,
    b.results.autocannon.timeouts,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function exportComparisonToCsv(comparison: ComparisonResult): string {
  const headers = [
    'metric',
    'baseline',
    'target',
    'absolute_diff',
    'percentage_diff',
    'improved',
  ];

  const rows = [
    [
      'requests_per_sec',
      comparison.baseline.results.autocannon.requestsPerSecond.mean.toFixed(2),
      comparison.target.results.autocannon.requestsPerSecond.mean.toFixed(2),
      comparison.diff.requestsPerSecond.absolute.toFixed(2),
      comparison.diff.requestsPerSecond.percentage.toFixed(2),
      comparison.diff.requestsPerSecond.improved,
    ],
    [
      'latency_p50_ms',
      comparison.baseline.results.autocannon.latency.p50.toFixed(2),
      comparison.target.results.autocannon.latency.p50.toFixed(2),
      comparison.diff.latencyP50.absolute.toFixed(2),
      comparison.diff.latencyP50.percentage.toFixed(2),
      comparison.diff.latencyP50.improved,
    ],
    [
      'latency_p99_ms',
      comparison.baseline.results.autocannon.latency.p99.toFixed(2),
      comparison.target.results.autocannon.latency.p99.toFixed(2),
      comparison.diff.latencyP99.absolute.toFixed(2),
      comparison.diff.latencyP99.percentage.toFixed(2),
      comparison.diff.latencyP99.improved,
    ],
    [
      'errors',
      comparison.baseline.results.autocannon.errors,
      comparison.target.results.autocannon.errors,
      comparison.diff.errors.absolute,
      'N/A',
      comparison.diff.errors.improved,
    ],
  ];

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

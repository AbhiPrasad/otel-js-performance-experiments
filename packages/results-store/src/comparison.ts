import type { StoredBenchmark, ComparisonResult, MetricDiff } from './schema.js';

// Threshold for considering a change significant (percentage)
const SIGNIFICANT_THRESHOLD = 5;

export function compareResults(
  baseline: StoredBenchmark,
  target: StoredBenchmark
): ComparisonResult {
  const baselineRps = baseline.results.autocannon.requestsPerSecond.mean;
  const targetRps = target.results.autocannon.requestsPerSecond.mean;

  const baselineLatencyP50 = baseline.results.autocannon.latency.p50;
  const targetLatencyP50 = target.results.autocannon.latency.p50;

  const baselineLatencyP99 = baseline.results.autocannon.latency.p99;
  const targetLatencyP99 = target.results.autocannon.latency.p99;

  const baselineThroughput = baseline.results.autocannon.throughput.mean;
  const targetThroughput = target.results.autocannon.throughput.mean;

  const diff = {
    requestsPerSecond: calculateDiff(baselineRps, targetRps, true),
    latencyP50: calculateDiff(baselineLatencyP50, targetLatencyP50, false),
    latencyP99: calculateDiff(baselineLatencyP99, targetLatencyP99, false),
    throughput: calculateDiff(baselineThroughput, targetThroughput, true),
    errors: {
      absolute: target.results.autocannon.errors - baseline.results.autocannon.errors,
      improved: target.results.autocannon.errors <= baseline.results.autocannon.errors,
    },
  };

  const significantChanges = generateSignificantChanges(diff);
  const summary = determineSummary(diff);

  return {
    baseline,
    target,
    diff,
    summary,
    significantChanges,
  };
}

function calculateDiff(
  baseline: number,
  target: number,
  higherIsBetter: boolean
): MetricDiff {
  const absolute = target - baseline;
  const percentage = baseline !== 0 ? ((target - baseline) / baseline) * 100 : 0;

  let improved: boolean;
  if (higherIsBetter) {
    improved = target > baseline;
  } else {
    improved = target < baseline;
  }

  return { absolute, percentage, improved };
}

function generateSignificantChanges(diff: ComparisonResult['diff']): string[] {
  const changes: string[] = [];

  if (Math.abs(diff.requestsPerSecond.percentage) >= SIGNIFICANT_THRESHOLD) {
    const direction = diff.requestsPerSecond.improved ? 'increased' : 'decreased';
    changes.push(
      `Requests/sec ${direction} by ${Math.abs(diff.requestsPerSecond.percentage).toFixed(1)}%`
    );
  }

  if (Math.abs(diff.latencyP50.percentage) >= SIGNIFICANT_THRESHOLD) {
    const direction = diff.latencyP50.improved ? 'decreased' : 'increased';
    changes.push(
      `P50 latency ${direction} by ${Math.abs(diff.latencyP50.percentage).toFixed(1)}%`
    );
  }

  if (Math.abs(diff.latencyP99.percentage) >= SIGNIFICANT_THRESHOLD) {
    const direction = diff.latencyP99.improved ? 'decreased' : 'increased';
    changes.push(
      `P99 latency ${direction} by ${Math.abs(diff.latencyP99.percentage).toFixed(1)}%`
    );
  }

  if (Math.abs(diff.throughput.percentage) >= SIGNIFICANT_THRESHOLD) {
    const direction = diff.throughput.improved ? 'increased' : 'decreased';
    changes.push(
      `Throughput ${direction} by ${Math.abs(diff.throughput.percentage).toFixed(1)}%`
    );
  }

  if (diff.errors.absolute !== 0) {
    const direction = diff.errors.improved ? 'decreased' : 'increased';
    changes.push(`Errors ${direction} by ${Math.abs(diff.errors.absolute)}`);
  }

  return changes;
}

function determineSummary(diff: ComparisonResult['diff']): 'improved' | 'regressed' | 'neutral' {
  let improvements = 0;
  let regressions = 0;

  // Weight requests/sec more heavily
  if (Math.abs(diff.requestsPerSecond.percentage) >= SIGNIFICANT_THRESHOLD) {
    if (diff.requestsPerSecond.improved) {
      improvements += 2;
    } else {
      regressions += 2;
    }
  }

  if (Math.abs(diff.latencyP50.percentage) >= SIGNIFICANT_THRESHOLD) {
    if (diff.latencyP50.improved) {
      improvements++;
    } else {
      regressions++;
    }
  }

  if (Math.abs(diff.latencyP99.percentage) >= SIGNIFICANT_THRESHOLD) {
    if (diff.latencyP99.improved) {
      improvements++;
    } else {
      regressions++;
    }
  }

  // Errors are critical
  if (diff.errors.absolute > 0) {
    regressions += 3;
  } else if (diff.errors.absolute < 0) {
    improvements++;
  }

  if (improvements > regressions) {
    return 'improved';
  } else if (regressions > improvements) {
    return 'regressed';
  }

  return 'neutral';
}

export function formatPercentage(value: number, showSign: boolean = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatLatency(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  }
  return `${ms.toFixed(2)}ms`;
}

export function formatNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(2)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(2)}K`;
  }
  return n.toFixed(0);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  }
  if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

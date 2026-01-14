import type { StoredBenchmark, ComparisonResult } from '../schema.js';

export function exportBenchmarkToJson(benchmark: StoredBenchmark): string {
  return JSON.stringify(benchmark, null, 2);
}

export function exportComparisonToJson(comparison: ComparisonResult): string {
  return JSON.stringify(
    {
      baseline: {
        label: comparison.baseline.metadata.label,
        git: comparison.baseline.metadata.git,
        timestamp: comparison.baseline.metadata.timestamp,
      },
      target: {
        label: comparison.target.metadata.label,
        git: comparison.target.metadata.git,
        timestamp: comparison.target.metadata.timestamp,
      },
      diff: comparison.diff,
      summary: comparison.summary,
      significantChanges: comparison.significantChanges,
    },
    null,
    2
  );
}

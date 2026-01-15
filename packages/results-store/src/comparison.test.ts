import { describe, it, expect } from 'vitest';
import {
  compareResults,
  formatPercentage,
  formatLatency,
  formatNumber,
  formatBytes,
} from './comparison.js';
import type { StoredBenchmark } from './schema.js';

// Helper to create a minimal StoredBenchmark for testing
function createBenchmark(overrides: {
  requestsPerSecond?: number;
  latencyP50?: number;
  latencyP99?: number;
  throughput?: number;
  errors?: number;
}): StoredBenchmark {
  return {
    metadata: {
      id: 'test-id',
      label: 'test-label',
      timestamp: '2024-01-01T00:00:00.000Z',
      git: {
        branch: 'main',
        commit: 'abc123',
        shortCommit: 'abc123',
        commitMessage: 'test',
        commitDate: '2024-01-01',
      },
      environment: {
        nodeVersion: 'v20.0.0',
        platform: 'linux',
        arch: 'x64',
        cpuModel: 'test',
        cpuCores: 4,
        totalMemory: 16000000000,
      },
      config: {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      },
    },
    results: {
      autocannon: {
        requestsPerSecond: {
          mean: overrides.requestsPerSecond ?? 1000,
          stddev: 50,
          min: 900,
          max: 1100,
          p50: 1000,
          p90: 1050,
          p99: 1080,
        },
        latency: {
          mean: 10,
          stddev: 2,
          min: 5,
          max: 20,
          p50: overrides.latencyP50 ?? 10,
          p90: 15,
          p99: overrides.latencyP99 ?? 18,
        },
        throughput: {
          mean: overrides.throughput ?? 1000000,
          stddev: 50000,
          min: 900000,
          max: 1100000,
        },
        totalRequests: 30000,
        errors: overrides.errors ?? 0,
        timeouts: 0,
      },
    },
  };
}

describe('compareResults', () => {
  describe('calculateDiff behavior (via compareResults)', () => {
    it('should calculate positive percentage change correctly', () => {
      const baseline = createBenchmark({ requestsPerSecond: 1000 });
      const target = createBenchmark({ requestsPerSecond: 1100 });

      const result = compareResults(baseline, target);

      expect(result.diff.requestsPerSecond.absolute).toBe(100);
      expect(result.diff.requestsPerSecond.percentage).toBeCloseTo(10, 1);
      expect(result.diff.requestsPerSecond.improved).toBe(true);
    });

    it('should calculate negative percentage change correctly', () => {
      const baseline = createBenchmark({ requestsPerSecond: 1000 });
      const target = createBenchmark({ requestsPerSecond: 900 });

      const result = compareResults(baseline, target);

      expect(result.diff.requestsPerSecond.absolute).toBe(-100);
      expect(result.diff.requestsPerSecond.percentage).toBeCloseTo(-10, 1);
      expect(result.diff.requestsPerSecond.improved).toBe(false);
    });

    it('should handle zero baseline (division by zero)', () => {
      const baseline = createBenchmark({ requestsPerSecond: 0 });
      const target = createBenchmark({ requestsPerSecond: 100 });

      const result = compareResults(baseline, target);

      expect(result.diff.requestsPerSecond.percentage).toBe(0);
      expect(result.diff.requestsPerSecond.absolute).toBe(100);
    });

    it('should handle latency correctly (lower is better)', () => {
      const baseline = createBenchmark({ latencyP50: 20 });
      const target = createBenchmark({ latencyP50: 15 });

      const result = compareResults(baseline, target);

      // Lower latency is better, so this should be an improvement
      expect(result.diff.latencyP50.improved).toBe(true);
      expect(result.diff.latencyP50.absolute).toBe(-5);
      expect(result.diff.latencyP50.percentage).toBeCloseTo(-25, 1);
    });

    it('should handle latency regression (higher is worse)', () => {
      const baseline = createBenchmark({ latencyP50: 10 });
      const target = createBenchmark({ latencyP50: 15 });

      const result = compareResults(baseline, target);

      expect(result.diff.latencyP50.improved).toBe(false);
      expect(result.diff.latencyP50.absolute).toBe(5);
      expect(result.diff.latencyP50.percentage).toBeCloseTo(50, 1);
    });
  });

  describe('error handling', () => {
    it('should track increased errors as regression', () => {
      const baseline = createBenchmark({ errors: 0 });
      const target = createBenchmark({ errors: 5 });

      const result = compareResults(baseline, target);

      expect(result.diff.errors.absolute).toBe(5);
      expect(result.diff.errors.improved).toBe(false);
    });

    it('should track decreased errors as improvement', () => {
      const baseline = createBenchmark({ errors: 10 });
      const target = createBenchmark({ errors: 5 });

      const result = compareResults(baseline, target);

      expect(result.diff.errors.absolute).toBe(-5);
      expect(result.diff.errors.improved).toBe(true);
    });
  });

  describe('significant changes', () => {
    it('should detect significant RPS change (>=5%)', () => {
      const baseline = createBenchmark({ requestsPerSecond: 1000 });
      const target = createBenchmark({ requestsPerSecond: 1100 });

      const result = compareResults(baseline, target);

      expect(result.significantChanges).toContain(
        'Requests/sec increased by 10.0%'
      );
    });

    it('should not flag insignificant changes (<5%)', () => {
      const baseline = createBenchmark({ requestsPerSecond: 1000 });
      const target = createBenchmark({ requestsPerSecond: 1020 });

      const result = compareResults(baseline, target);

      const rpsChange = result.significantChanges.find((c) =>
        c.includes('Requests/sec')
      );
      expect(rpsChange).toBeUndefined();
    });

    it('should detect error changes regardless of percentage', () => {
      const baseline = createBenchmark({ errors: 0 });
      const target = createBenchmark({ errors: 1 });

      const result = compareResults(baseline, target);

      expect(result.significantChanges).toContain('Errors increased by 1');
    });
  });

  describe('summary determination', () => {
    it('should return improved when RPS significantly increased', () => {
      const baseline = createBenchmark({ requestsPerSecond: 1000 });
      const target = createBenchmark({ requestsPerSecond: 1200 });

      const result = compareResults(baseline, target);

      expect(result.summary).toBe('improved');
    });

    it('should return regressed when RPS significantly decreased', () => {
      const baseline = createBenchmark({ requestsPerSecond: 1000 });
      const target = createBenchmark({ requestsPerSecond: 800 });

      const result = compareResults(baseline, target);

      expect(result.summary).toBe('regressed');
    });

    it('should return regressed when errors increased', () => {
      const baseline = createBenchmark({ errors: 0 });
      const target = createBenchmark({ errors: 10 });

      const result = compareResults(baseline, target);

      expect(result.summary).toBe('regressed');
    });

    it('should return neutral when no significant changes', () => {
      const baseline = createBenchmark({});
      const target = createBenchmark({});

      const result = compareResults(baseline, target);

      expect(result.summary).toBe('neutral');
    });
  });
});

describe('formatPercentage', () => {
  it('should format positive percentage with + sign', () => {
    expect(formatPercentage(10.5)).toBe('+10.50%');
  });

  it('should format negative percentage without + sign', () => {
    expect(formatPercentage(-10.5)).toBe('-10.50%');
  });

  it('should format zero without + sign', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });

  it('should omit sign when showSign is false', () => {
    expect(formatPercentage(10.5, false)).toBe('10.50%');
  });
});

describe('formatLatency', () => {
  it('should format sub-millisecond latency in microseconds', () => {
    expect(formatLatency(0.5)).toBe('500μs');
  });

  it('should format millisecond latency', () => {
    expect(formatLatency(5.25)).toBe('5.25ms');
  });

  it('should handle exactly 1ms', () => {
    expect(formatLatency(1)).toBe('1.00ms');
  });
});

describe('formatNumber', () => {
  it('should format millions with M suffix', () => {
    expect(formatNumber(1500000)).toBe('1.50M');
  });

  it('should format thousands with K suffix', () => {
    expect(formatNumber(1500)).toBe('1.50K');
  });

  it('should format small numbers without suffix', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('should format exactly 1000 with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.00K');
  });
});

describe('formatBytes', () => {
  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('should format bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('should handle large GB values', () => {
    expect(formatBytes(16 * 1073741824)).toBe('16.00 GB');
  });
});

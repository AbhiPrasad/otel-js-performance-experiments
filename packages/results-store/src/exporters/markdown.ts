import type { StoredBenchmark, ComparisonResult } from '../schema.js';
import { formatPercentage, formatLatency, formatNumber, formatBytes } from '../comparison.js';

export function exportBenchmarkToMarkdown(benchmark: StoredBenchmark): string {
  const { metadata, results } = benchmark;

  return `# Benchmark Results: ${metadata.label}

## Metadata
- **ID**: ${metadata.id}
- **Timestamp**: ${metadata.timestamp}
- **App**: ${metadata.config.app}
- **Scenario**: ${metadata.config.scenario}
- **Mode**: ${metadata.config.mode}

## Git Info
- **Branch**: ${metadata.git.branch}
- **Commit**: ${metadata.git.shortCommit}
- **Message**: ${metadata.git.commitMessage}
${metadata.git.tag ? `- **Tag**: ${metadata.git.tag}` : ''}

## Environment
- **Node.js**: ${metadata.environment.nodeVersion}
- **Platform**: ${metadata.environment.platform} (${metadata.environment.arch})
- **CPU**: ${metadata.environment.cpuModel} (${metadata.environment.cpuCores} cores)
- **Memory**: ${formatBytes(metadata.environment.totalMemory)}

## Configuration
- **Connections**: ${metadata.config.connections}
- **Duration**: ${metadata.config.duration}s
- **Pipelining**: ${metadata.config.pipelining}

## Results

### Requests/Second
| Metric | Value |
|--------|-------|
| Mean | ${formatNumber(results.autocannon.requestsPerSecond.mean)} |
| P50 | ${formatNumber(results.autocannon.requestsPerSecond.p50)} |
| P90 | ${formatNumber(results.autocannon.requestsPerSecond.p90)} |
| P99 | ${formatNumber(results.autocannon.requestsPerSecond.p99)} |

### Latency
| Metric | Value |
|--------|-------|
| Mean | ${formatLatency(results.autocannon.latency.mean)} |
| P50 | ${formatLatency(results.autocannon.latency.p50)} |
| P90 | ${formatLatency(results.autocannon.latency.p90)} |
| P99 | ${formatLatency(results.autocannon.latency.p99)} |

### Summary
- **Total Requests**: ${formatNumber(results.autocannon.totalRequests)}
- **Throughput**: ${formatBytes(results.autocannon.throughput.mean)}/s
- **Errors**: ${results.autocannon.errors}
- **Timeouts**: ${results.autocannon.timeouts}
`;
}

export function exportComparisonToMarkdown(
  comparison: ComparisonResult,
  options?: {
    artifactUrl?: string;
    includeHeader?: boolean;
  }
): string {
  const { baseline, target, diff, summary, significantChanges } = comparison;
  const { artifactUrl, includeHeader = true } = options || {};

  const summaryEmoji = summary === 'improved' ? '🟢' : summary === 'regressed' ? '🔴' : '🟡';
  const summaryText = summary.toUpperCase();

  let md = '';

  if (includeHeader) {
    md += `## Performance Benchmark Results: ${target.metadata.label}

`;
  }

  md += `**Baseline**: ${baseline.metadata.git.tag || baseline.metadata.label} (${baseline.metadata.git.shortCommit})
**Target**: ${target.metadata.label} (${target.metadata.git.shortCommit})
**Run Date**: ${target.metadata.timestamp}
**Environment**: Node ${target.metadata.environment.nodeVersion}, ${target.metadata.environment.platform}, ${target.metadata.environment.cpuCores} CPU cores

### Summary
${summaryEmoji} **Overall: ${summaryText}**
`;

  if (significantChanges.length > 0) {
    md += `
${significantChanges.map((c) => `- ${c}`).join('\n')}
`;
  }

  md += `
### Detailed Results

| Metric | Baseline | Target | Change |
|--------|----------|--------|--------|
| Requests/sec (mean) | ${formatNumber(baseline.results.autocannon.requestsPerSecond.mean)} | ${formatNumber(target.results.autocannon.requestsPerSecond.mean)} | ${formatPercentage(diff.requestsPerSecond.percentage)} ${diff.requestsPerSecond.improved ? '✅' : '❌'} |
| Latency p50 | ${formatLatency(baseline.results.autocannon.latency.p50)} | ${formatLatency(target.results.autocannon.latency.p50)} | ${formatPercentage(diff.latencyP50.percentage)} ${diff.latencyP50.improved ? '✅' : '❌'} |
| Latency p99 | ${formatLatency(baseline.results.autocannon.latency.p99)} | ${formatLatency(target.results.autocannon.latency.p99)} | ${formatPercentage(diff.latencyP99.percentage)} ${diff.latencyP99.improved ? '✅' : '❌'} |
| Throughput | ${formatBytes(baseline.results.autocannon.throughput.mean)}/s | ${formatBytes(target.results.autocannon.throughput.mean)}/s | ${formatPercentage(diff.throughput.percentage)} ${diff.throughput.improved ? '✅' : '❌'} |
| Errors | ${baseline.results.autocannon.errors} | ${target.results.autocannon.errors} | ${diff.errors.absolute} ${diff.errors.improved ? '✅' : '❌'} |
`;

  if (artifactUrl || target.results.clinicReports) {
    md += `
### Clinic.js Profiles
`;
    if (artifactUrl) {
      md += `- [Download All Profiles](${artifactUrl})
`;
    }
    if (target.results.clinicReports?.flame) {
      md += `- Flame Graph: \`${target.results.clinicReports.flame}\`
`;
    }
    if (target.results.clinicReports?.doctor) {
      md += `- Doctor Report: \`${target.results.clinicReports.doctor}\`
`;
    }
  }

  md += `
### Test Configuration
- **App**: ${target.metadata.config.app}
- **Scenario**: ${target.metadata.config.scenario}
- **Mode**: ${target.metadata.config.mode}
- **Duration**: ${target.metadata.config.duration}s
- **Connections**: ${target.metadata.config.connections} concurrent
`;

  return md;
}

import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  ResultsStorage,
  compareResults,
  exportComparisonToMarkdown,
  exportComparisonToJson,
  ComparisonResult,
} from '@otel-perf/results-store';
import { parseArgs, getProjectRoot } from '../utils.js';

interface CompareOptions {
  baseline: string;
  target: string;
  format: 'table' | 'json' | 'markdown';
  app?: string;
  scenario?: string;
  mode?: string;
}

export async function compareCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  const options: CompareOptions = {
    baseline: parsedArgs.baseline as string,
    target: parsedArgs.target as string,
    format: (parsedArgs.format as 'table' | 'json' | 'markdown') || 'table',
    app: parsedArgs.app as string | undefined,
    scenario: parsedArgs.scenario as string | undefined,
    mode: parsedArgs.mode as string | undefined,
  };

  if (!options.baseline || !options.target) {
    console.error(chalk.red('Error: --baseline and --target are required'));
    process.exit(1);
  }

  const projectRoot = getProjectRoot();
  const resultsDir = path.join(projectRoot, 'results');
  const storage = new ResultsStorage({ resultsDir });

  // Find all matching pairs of results
  const pairs = await storage.findMatchingPairs(
    options.baseline,
    options.target,
    options.app,
    options.scenario,
    options.mode
  );

  if (pairs.length === 0) {
    // Fall back to single result comparison for backwards compatibility
    const baseline = await storage.load(options.baseline);
    const target = await storage.load(options.target);

    if (!baseline) {
      console.error(chalk.red(`Baseline not found: ${options.baseline}`));
      process.exit(1);
    }

    if (!target) {
      console.error(chalk.red(`Target not found: ${options.target}`));
      process.exit(1);
    }

    // Warn if comparing different scenarios
    if (
      baseline.metadata.config.app !== target.metadata.config.app ||
      baseline.metadata.config.scenario !== target.metadata.config.scenario ||
      baseline.metadata.config.mode !== target.metadata.config.mode
    ) {
      console.error(
        chalk.yellow(
          `Warning: Comparing different configurations:\n` +
            `  Baseline: ${baseline.metadata.config.app}/${baseline.metadata.config.scenario}/${baseline.metadata.config.mode}\n` +
            `  Target: ${target.metadata.config.app}/${target.metadata.config.scenario}/${target.metadata.config.mode}`
        )
      );
    }

    const comparison = compareResults(baseline, target);
    outputSingleComparison(comparison, options.format);
    return;
  }

  // Compare all matching pairs
  const comparisons = pairs.map(({ baseline, target }) => compareResults(baseline, target));

  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(comparisons.map((c) => JSON.parse(exportComparisonToJson(c))), null, 2));
      break;
    case 'markdown':
      outputMultiComparisonMarkdown(comparisons, options.baseline, options.target);
      break;
    case 'table':
    default:
      outputMultiComparisonTable(comparisons, options.baseline, options.target);
      break;
  }
}

function outputSingleComparison(
  comparison: ComparisonResult,
  format: 'table' | 'json' | 'markdown'
): void {
  switch (format) {
    case 'json':
      console.log(exportComparisonToJson(comparison));
      break;
    case 'markdown':
      console.log(exportComparisonToMarkdown(comparison));
      break;
    case 'table':
    default:
      printComparisonTable(comparison);
      break;
  }
}

function outputMultiComparisonTable(
  comparisons: ComparisonResult[],
  baselineLabel: string,
  targetLabel: string
): void {
  const firstBaseline = comparisons[0].baseline;
  const firstTarget = comparisons[0].target;

  console.log(chalk.bold('\nMulti-Scenario Comparison Results'));
  console.log(chalk.gray('─'.repeat(80)));
  console.log(`Baseline: ${chalk.cyan(baselineLabel)} (${firstBaseline.metadata.git.shortCommit})`);
  console.log(`Target:   ${chalk.cyan(targetLabel)} (${firstTarget.metadata.git.shortCommit})`);
  console.log(`Scenarios compared: ${comparisons.length}`);

  // Summary statistics
  const improved = comparisons.filter((c) => c.summary === 'improved').length;
  const regressed = comparisons.filter((c) => c.summary === 'regressed').length;
  const neutral = comparisons.filter((c) => c.summary === 'neutral').length;

  const overallSummary =
    regressed > improved ? 'regressed' : improved > regressed ? 'improved' : 'neutral';
  const summaryEmoji =
    overallSummary === 'improved' ? '🟢' : overallSummary === 'regressed' ? '🔴' : '🟡';
  const summaryColor =
    overallSummary === 'improved'
      ? chalk.green
      : overallSummary === 'regressed'
        ? chalk.red
        : chalk.yellow;

  console.log(`\nOverall: ${summaryEmoji} ${summaryColor(overallSummary.toUpperCase())}`);
  console.log(`  Improved: ${improved}, Regressed: ${regressed}, Neutral: ${neutral}`);

  // Per-scenario table
  const table = new Table({
    head: ['App', 'Scenario', 'Mode', 'Req/s Δ', 'p50 Δ', 'p99 Δ', 'Status'],
    style: { head: ['cyan'] },
  });

  for (const comparison of comparisons) {
    const { baseline, diff, summary } = comparison;
    const { app, scenario, mode } = baseline.metadata.config;

    const formatPct = (pct: number, improved: boolean) => {
      const sign = pct > 0 ? '+' : '';
      const color = improved ? chalk.green : pct === 0 ? chalk.gray : chalk.red;
      return color(`${sign}${pct.toFixed(1)}%`);
    };

    const statusEmoji = summary === 'improved' ? '✅' : summary === 'regressed' ? '❌' : '➖';

    table.push([
      app,
      scenario,
      mode,
      formatPct(diff.requestsPerSecond.percentage, diff.requestsPerSecond.improved),
      formatPct(diff.latencyP50.percentage, diff.latencyP50.improved),
      formatPct(diff.latencyP99.percentage, diff.latencyP99.improved),
      statusEmoji,
    ]);
  }

  console.log('\n' + table.toString());

  // Aggregate statistics
  const avgRpsChange =
    comparisons.reduce((sum, c) => sum + c.diff.requestsPerSecond.percentage, 0) /
    comparisons.length;
  const avgP50Change =
    comparisons.reduce((sum, c) => sum + c.diff.latencyP50.percentage, 0) / comparisons.length;
  const avgP99Change =
    comparisons.reduce((sum, c) => sum + c.diff.latencyP99.percentage, 0) / comparisons.length;

  console.log(chalk.bold('\nAggregate Changes (mean across all scenarios):'));
  console.log(`  Requests/sec: ${avgRpsChange > 0 ? '+' : ''}${avgRpsChange.toFixed(2)}%`);
  console.log(`  P50 latency:  ${avgP50Change > 0 ? '+' : ''}${avgP50Change.toFixed(2)}%`);
  console.log(`  P99 latency:  ${avgP99Change > 0 ? '+' : ''}${avgP99Change.toFixed(2)}%`);
}

function outputMultiComparisonMarkdown(
  comparisons: ComparisonResult[],
  baselineLabel: string,
  targetLabel: string
): void {
  const firstBaseline = comparisons[0].baseline;
  const firstTarget = comparisons[0].target;

  // Summary statistics
  const improved = comparisons.filter((c) => c.summary === 'improved').length;
  const regressed = comparisons.filter((c) => c.summary === 'regressed').length;
  const neutral = comparisons.filter((c) => c.summary === 'neutral').length;

  const overallSummary =
    regressed > improved ? 'regressed' : improved > regressed ? 'improved' : 'neutral';
  const summaryEmoji =
    overallSummary === 'improved' ? '🟢' : overallSummary === 'regressed' ? '🔴' : '🟡';

  console.log(`## Performance Benchmark Results: ${targetLabel}`);
  console.log('');
  console.log(`**Baseline**: ${baselineLabel} (${firstBaseline.metadata.git.shortCommit})`);
  console.log(`**Target**: ${targetLabel} (${firstTarget.metadata.git.shortCommit})`);
  console.log(
    `**Run Date**: ${firstTarget.metadata.timestamp}`
  );
  console.log(
    `**Environment**: Node ${firstTarget.metadata.environment.nodeVersion}, ${firstTarget.metadata.environment.platform}, ${firstTarget.metadata.environment.cpuCores} CPU cores`
  );
  console.log('');
  console.log('### Summary');
  console.log(`${summaryEmoji} **Overall: ${overallSummary.toUpperCase()}**`);
  console.log('');
  console.log(`- Scenarios compared: ${comparisons.length}`);
  console.log(`- Improved: ${improved}, Regressed: ${regressed}, Neutral: ${neutral}`);
  console.log('');

  // Aggregate statistics
  const avgRpsChange =
    comparisons.reduce((sum, c) => sum + c.diff.requestsPerSecond.percentage, 0) /
    comparisons.length;
  const avgP50Change =
    comparisons.reduce((sum, c) => sum + c.diff.latencyP50.percentage, 0) / comparisons.length;
  const avgP99Change =
    comparisons.reduce((sum, c) => sum + c.diff.latencyP99.percentage, 0) / comparisons.length;

  console.log('### Aggregate Changes (mean across all scenarios)');
  console.log('');
  console.log(`- Requests/sec: ${avgRpsChange > 0 ? '+' : ''}${avgRpsChange.toFixed(2)}%`);
  console.log(`- P50 latency: ${avgP50Change > 0 ? '+' : ''}${avgP50Change.toFixed(2)}%`);
  console.log(`- P99 latency: ${avgP99Change > 0 ? '+' : ''}${avgP99Change.toFixed(2)}%`);
  console.log('');

  // Detailed results table
  console.log('### Detailed Results');
  console.log('');
  console.log('| App | Scenario | Mode | Req/s Δ | p50 Δ | p99 Δ | Status |');
  console.log('|-----|----------|------|---------|-------|-------|--------|');

  for (const comparison of comparisons) {
    const { baseline, diff, summary } = comparison;
    const { app, scenario, mode } = baseline.metadata.config;

    const formatPct = (pct: number, improved: boolean) => {
      const sign = pct > 0 ? '+' : '';
      const icon = improved ? '' : pct === 0 ? '' : '';
      return `${sign}${pct.toFixed(1)}% ${icon}`.trim();
    };

    const statusEmoji = summary === 'improved' ? '✅' : summary === 'regressed' ? '❌' : '➖';

    console.log(
      `| ${app} | ${scenario} | ${mode} | ${formatPct(diff.requestsPerSecond.percentage, diff.requestsPerSecond.improved)} | ${formatPct(diff.latencyP50.percentage, diff.latencyP50.improved)} | ${formatPct(diff.latencyP99.percentage, diff.latencyP99.improved)} | ${statusEmoji} |`
    );
  }

  console.log('');
}

function printComparisonTable(comparison: ReturnType<typeof compareResults>): void {
  const { baseline, target, diff, summary, significantChanges } = comparison;

  const summaryEmoji = summary === 'improved' ? '🟢' : summary === 'regressed' ? '🔴' : '🟡';
  const summaryColor =
    summary === 'improved' ? chalk.green : summary === 'regressed' ? chalk.red : chalk.yellow;

  console.log(chalk.bold('\nComparison Results'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(
    `Baseline: ${chalk.cyan(baseline.metadata.label)} (${baseline.metadata.git.shortCommit})`
  );
  console.log(`Target:   ${chalk.cyan(target.metadata.label)} (${target.metadata.git.shortCommit})`);
  console.log(
    `Config:   ${baseline.metadata.config.app}/${baseline.metadata.config.scenario}/${baseline.metadata.config.mode}`
  );
  console.log(`\nOverall: ${summaryEmoji} ${summaryColor(summary.toUpperCase())}`);

  if (significantChanges.length > 0) {
    console.log('\nSignificant changes:');
    significantChanges.forEach((change) => {
      console.log(`  • ${change}`);
    });
  }

  const table = new Table({
    head: ['Metric', 'Baseline', 'Target', 'Change', ''],
    style: { head: ['cyan'] },
  });

  const formatChange = (pct: number, improved: boolean) => {
    const sign = pct > 0 ? '+' : '';
    const color = improved ? chalk.green : chalk.red;
    const icon = improved ? '✅' : '❌';
    return [color(`${sign}${pct.toFixed(2)}%`), icon];
  };

  table.push(
    [
      'Requests/sec (mean)',
      baseline.results.autocannon.requestsPerSecond.mean.toFixed(0),
      target.results.autocannon.requestsPerSecond.mean.toFixed(0),
      ...formatChange(diff.requestsPerSecond.percentage, diff.requestsPerSecond.improved),
    ],
    [
      'Latency p50',
      `${baseline.results.autocannon.latency.p50.toFixed(2)}ms`,
      `${target.results.autocannon.latency.p50.toFixed(2)}ms`,
      ...formatChange(diff.latencyP50.percentage, diff.latencyP50.improved),
    ],
    [
      'Latency p99',
      `${baseline.results.autocannon.latency.p99.toFixed(2)}ms`,
      `${target.results.autocannon.latency.p99.toFixed(2)}ms`,
      ...formatChange(diff.latencyP99.percentage, diff.latencyP99.improved),
    ],
    [
      'Throughput',
      `${(baseline.results.autocannon.throughput.mean / 1024 / 1024).toFixed(2)} MB/s`,
      `${(target.results.autocannon.throughput.mean / 1024 / 1024).toFixed(2)} MB/s`,
      ...formatChange(diff.throughput.percentage, diff.throughput.improved),
    ],
    [
      'Errors',
      baseline.results.autocannon.errors.toString(),
      target.results.autocannon.errors.toString(),
      diff.errors.absolute.toString(),
      diff.errors.improved ? '✅' : '❌',
    ]
  );

  console.log('\n' + table.toString());
}

import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ResultsStorage, compareResults, exportComparisonToMarkdown, exportComparisonToJson } from '@otel-perf/results-store';
import { parseArgs, getProjectRoot } from '../utils.js';

interface CompareOptions {
  baseline: string;
  target: string;
  format: 'table' | 'json' | 'markdown';
}

export async function compareCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  const options: CompareOptions = {
    baseline: parsedArgs.baseline as string,
    target: parsedArgs.target as string,
    format: (parsedArgs.format as 'table' | 'json' | 'markdown') || 'table',
  };

  if (!options.baseline || !options.target) {
    console.error(chalk.red('Error: --baseline and --target are required'));
    process.exit(1);
  }

  const projectRoot = getProjectRoot();
  const resultsDir = path.join(projectRoot, 'results');
  const storage = new ResultsStorage({ resultsDir });

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

  const comparison = compareResults(baseline, target);

  switch (options.format) {
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

function printComparisonTable(comparison: ReturnType<typeof compareResults>): void {
  const { baseline, target, diff, summary, significantChanges } = comparison;

  const summaryEmoji = summary === 'improved' ? '🟢' : summary === 'regressed' ? '🔴' : '🟡';
  const summaryColor = summary === 'improved' ? chalk.green : summary === 'regressed' ? chalk.red : chalk.yellow;

  console.log(chalk.bold('\nComparison Results'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`Baseline: ${chalk.cyan(baseline.metadata.label)} (${baseline.metadata.git.shortCommit})`);
  console.log(`Target:   ${chalk.cyan(target.metadata.label)} (${target.metadata.git.shortCommit})`);
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

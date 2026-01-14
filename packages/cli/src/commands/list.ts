import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ResultsStorage } from '@otel-perf/results-store';
import { parseArgs, getProjectRoot } from '../utils.js';

export async function listCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);
  const label = parsedArgs.label as string | undefined;

  const projectRoot = getProjectRoot();
  const resultsDir = path.join(projectRoot, 'results');
  const storage = new ResultsStorage({ resultsDir });

  const entries = label ? await storage.listByLabel(label) : await storage.list();

  if (entries.length === 0) {
    console.log(chalk.yellow('No benchmark results found.'));
    return;
  }

  console.log(chalk.bold(`\nStored Benchmark Results (${entries.length})`));
  console.log(chalk.gray('─'.repeat(80)));

  const table = new Table({
    head: ['Label', 'App', 'Scenario', 'Mode', 'Git', 'Timestamp'],
    style: { head: ['cyan'] },
    colWidths: [20, 10, 15, 15, 10, 25],
  });

  // Group by label
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!grouped.has(entry.label)) {
      grouped.set(entry.label, []);
    }
    grouped.get(entry.label)!.push(entry);
  }

  for (const [lbl, groupEntries] of grouped) {
    const first = groupEntries[0];
    table.push([
      chalk.cyan(lbl),
      groupEntries.map((e) => e.app).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      `${groupEntries.length} tests`,
      groupEntries.map((e) => e.mode).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      first.git.commit.substring(0, 7),
      new Date(first.timestamp).toLocaleString(),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.gray(`\nTotal: ${entries.length} results across ${grouped.size} labels`));
}

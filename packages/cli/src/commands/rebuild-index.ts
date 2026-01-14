import path from 'path';
import { ResultsStorage } from '@otel-perf/results-store';
import chalk from 'chalk';

export async function rebuildIndexCommand(_args: string[]) {
  const resultsDir = path.join(process.cwd(), 'results');
  const storage = new ResultsStorage({ resultsDir });

  console.log(chalk.blue('Rebuilding index from benchmark files...'));

  const count = await storage.rebuildIndex();

  if (count === 0) {
    console.log(chalk.yellow('No benchmark files found.'));
  } else {
    console.log(chalk.green(`Index rebuilt successfully with ${count} entries.`));
  }
}

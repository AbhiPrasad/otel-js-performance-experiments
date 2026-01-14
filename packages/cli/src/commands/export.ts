import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import {
  ResultsStorage,
  exportBenchmarkToJson,
  exportBenchmarkToCsv,
  exportBenchmarksToCsv,
  exportBenchmarkToMarkdown,
} from '@otel-perf/results-store';
import { parseArgs, getProjectRoot, expandPath } from '../utils.js';

interface ExportOptions {
  id: string;
  format: 'json' | 'csv' | 'markdown';
  output?: string;
}

export async function exportCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  const options: ExportOptions = {
    id: parsedArgs.id as string,
    format: (parsedArgs.format as 'json' | 'csv' | 'markdown') || 'json',
    output: parsedArgs.output as string | undefined,
  };

  if (!options.id) {
    console.error(chalk.red('Error: --id is required'));
    process.exit(1);
  }

  const projectRoot = getProjectRoot();
  const resultsDir = path.join(projectRoot, 'results');
  const storage = new ResultsStorage({ resultsDir });

  // Try to load as single result or by label
  let result = await storage.load(options.id);
  let results = result ? [result] : await storage.loadByLabel(options.id);

  if (results.length === 0) {
    console.error(chalk.red(`No results found for: ${options.id}`));
    process.exit(1);
  }

  let output: string;

  switch (options.format) {
    case 'json':
      if (results.length === 1) {
        output = exportBenchmarkToJson(results[0]);
      } else {
        output = JSON.stringify(results, null, 2);
      }
      break;
    case 'csv':
      if (results.length === 1) {
        output = exportBenchmarkToCsv(results[0]);
      } else {
        output = exportBenchmarksToCsv(results);
      }
      break;
    case 'markdown':
      output = results.map((r) => exportBenchmarkToMarkdown(r)).join('\n---\n\n');
      break;
  }

  if (options.output) {
    const outputPath = expandPath(options.output);
    await fs.writeFile(outputPath, output);
    console.log(chalk.green(`Exported to: ${outputPath}`));
  } else {
    console.log(output);
  }
}

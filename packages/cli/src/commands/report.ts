import path from 'path';
import chalk from 'chalk';
import { ResultsStorage, compareResults, exportComparisonToMarkdown } from '@otel-perf/results-store';
import { createIssueFromComparison } from '@otel-perf/github-reporter';
import { parseArgs, getProjectRoot } from '../utils.js';

interface ReportOptions {
  baseline: string;
  target: string;
  createIssue: boolean;
  artifactUrl?: string;
  pr?: number;
  owner?: string;
  repo?: string;
}

export async function reportCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  const options: ReportOptions = {
    baseline: parsedArgs.baseline as string,
    target: parsedArgs.target as string,
    createIssue: parsedArgs['create-issue'] === true,
    artifactUrl: parsedArgs['artifact-url'] as string | undefined,
    pr: parsedArgs.pr ? parseInt(parsedArgs.pr as string, 10) : undefined,
    owner: (parsedArgs.owner as string) || 'open-telemetry',
    repo: (parsedArgs.repo as string) || 'opentelemetry-js',
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

  // Generate markdown report
  const markdown = exportComparisonToMarkdown(comparison, {
    artifactUrl: options.artifactUrl,
    includeHeader: true,
  });

  if (options.createIssue) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error(chalk.red('Error: GITHUB_TOKEN environment variable is required to create issues'));
      process.exit(1);
    }

    console.log(chalk.cyan('Creating GitHub issue...'));

    try {
      const issue = await createIssueFromComparison(
        {
          token,
          owner: options.owner!,
          repo: options.repo!,
        },
        {
          comparison,
          prNumber: options.pr,
          artifactUrl: options.artifactUrl,
        }
      );

      console.log(chalk.green(`\nIssue created successfully!`));
      console.log(`Title: ${issue.title}`);
      console.log(`URL: ${chalk.cyan(issue.url)}`);
    } catch (error) {
      console.error(chalk.red(`Failed to create issue: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  } else {
    // Just print the markdown
    console.log(markdown);
  }
}

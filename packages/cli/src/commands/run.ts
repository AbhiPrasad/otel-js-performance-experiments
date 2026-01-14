import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { BenchmarkRunner, BENCHMARK_PRESETS } from '@otel-perf/benchmark-runner';
import { ResultsStorage } from '@otel-perf/results-store';
import { GitOperations } from '@otel-perf/otel-linker';
import { parseArgs, getDefaultOtelPath, expandPath, getProjectRoot } from '../utils.js';
import { SCENARIOS, INSTRUMENTATION_MODES } from '../config/scenarios.js';

interface RunOptions {
  app: string;
  scenario: string;
  mode: string;
  preset: string;
  label?: string;
  save: boolean;
  clinic?: string;
  otelPath: string;
}

export async function runCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  const options: RunOptions = {
    app: (parsedArgs.app as string) || 'all',
    scenario: (parsedArgs.scenario as string) || 'all',
    mode: (parsedArgs.mode as string) || 'all',
    preset: (parsedArgs.preset as string) || 'standard',
    label: parsedArgs.label as string | undefined,
    save: parsedArgs.save === true,
    clinic: parsedArgs.clinic as string | undefined,
    otelPath: expandPath((parsedArgs['otel-path'] as string) || getDefaultOtelPath()),
  };

  const projectRoot = getProjectRoot();
  const resultsDir = path.join(projectRoot, 'results');

  // Determine which apps to test
  const apps = options.app === 'all' ? ['express', 'fastify'] : [options.app];

  // Determine which scenarios to test
  const scenarios =
    options.scenario === 'all'
      ? SCENARIOS
      : SCENARIOS.filter((s) => s.name === options.scenario);

  // Determine which instrumentation modes to test
  const modes =
    options.mode === 'all'
      ? INSTRUMENTATION_MODES
      : INSTRUMENTATION_MODES.filter((m) => m.name === options.mode);

  // Get preset
  const preset = BENCHMARK_PRESETS[options.preset as keyof typeof BENCHMARK_PRESETS];
  if (!preset) {
    console.error(chalk.red(`Unknown preset: ${options.preset}`));
    process.exit(1);
  }

  // Get git info for labeling
  let gitInfo;
  try {
    const gitOps = new GitOperations({ otelJsPath: options.otelPath });
    const commitInfo = await gitOps.getCommitInfo();
    const branch = await gitOps.getCurrentBranch();
    gitInfo = {
      branch,
      commit: commitInfo.sha,
      shortCommit: commitInfo.shortSha,
      commitMessage: commitInfo.message,
      commitDate: commitInfo.date,
    };
  } catch {
    gitInfo = {
      branch: 'unknown',
      commit: 'unknown',
      shortCommit: 'unknown',
      commitMessage: '',
      commitDate: '',
    };
  }

  const label = options.label || `benchmark-${Date.now()}`;
  const totalTests = apps.length * scenarios.length * modes.length;
  let completedTests = 0;

  console.log(chalk.bold('\nOpenTelemetry Performance Benchmark'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Apps: ${chalk.cyan(apps.join(', '))}`);
  console.log(`Scenarios: ${chalk.cyan(scenarios.length)} scenarios`);
  console.log(`Modes: ${chalk.cyan(modes.map((m) => m.name).join(', '))}`);
  console.log(`Preset: ${chalk.cyan(options.preset)}`);
  console.log(`Label: ${chalk.cyan(label)}`);
  console.log(`Total tests: ${chalk.cyan(totalTests)}`);
  console.log(chalk.gray('─'.repeat(40)) + '\n');

  const storage = new ResultsStorage({ resultsDir });
  await storage.initialize();

  const runner = new BenchmarkRunner();
  const results: Array<{ config: any; result: any }> = [];

  for (const app of apps) {
    const appPath = path.join(projectRoot, 'apps', `${app}-app`);

    for (const scenario of scenarios) {
      for (const mode of modes) {
        completedTests++;
        const testName = `${app}/${scenario.name}/${mode.name}`;
        const spinner = ora(`[${completedTests}/${totalTests}] ${testName}`).start();

        try {
          const result = await runner.run({
            app: app as 'express' | 'fastify',
            appPath,
            scenario: {
              name: scenario.name,
              endpoint: scenario.endpoint,
              method: scenario.method,
              body: scenario.body,
            },
            instrumentationMode: {
              name: mode.name,
              envVars: mode.envVars,
            },
            preset: options.preset as keyof typeof BENCHMARK_PRESETS,
            clinic: options.clinic as 'doctor' | 'flame' | 'bubbleprof' | undefined,
            clinicOutputDir: path.join(resultsDir, 'clinic-reports'),
          });

          spinner.succeed(
            `${testName}: ${chalk.green(result.benchmarkResults.requestsPerSecond.mean.toFixed(0))} req/s, ` +
            `p50: ${chalk.yellow(result.benchmarkResults.latency.p50.toFixed(2))}ms`
          );

          results.push({ config: result.config, result: result.benchmarkResults });

          if (options.save) {
            await storage.save(
              label,
              {
                autocannon: result.benchmarkResults,
                clinicReports: result.clinicResults
                  ? { [options.clinic!]: result.clinicResults.htmlReportPath }
                  : undefined,
              },
              {
                app,
                scenario: scenario.name,
                mode: mode.name,
                connections: result.config.connections,
                duration: result.config.duration,
                pipelining: preset.pipelining,
              },
              gitInfo
            );
          }
        } catch (error) {
          spinner.fail(`${testName}: ${chalk.red(error instanceof Error ? error.message : 'Failed')}`);
        }
      }
    }
  }

  console.log(chalk.gray('\n' + '─'.repeat(40)));
  console.log(chalk.bold('Summary'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Completed: ${chalk.green(results.length)}/${totalTests} tests`);

  if (options.save) {
    console.log(`Results saved with label: ${chalk.cyan(label)}`);
  }

  await runner.cleanup();
}

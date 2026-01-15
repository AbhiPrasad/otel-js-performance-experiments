#!/usr/bin/env node

import { runCommand } from './commands/run.js';
import { compareCommand } from './commands/compare.js';
import { listCommand } from './commands/list.js';
import { exportCommand } from './commands/export.js';
import { reportCommand } from './commands/report.js';
import { rebuildIndexCommand } from './commands/rebuild-index.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
otel-perf - OpenTelemetry JavaScript Performance Benchmarking

Usage:
  otel-perf <command> [options]

Commands:
  run            Run benchmark suite
  compare        Compare two benchmark results
  list           List stored results
  export         Export results to file
  report         Create GitHub issue with results
  rebuild-index  Rebuild index from benchmark files

Run Options:
  --app <name>        Application to test (express, fastify, all) [default: all]
  --scenario <name>   Test scenario (simple-json, async-io-50ms, etc., all) [default: all]
  --mode <name>       Instrumentation mode (baseline, otel-noop, otel-console, all) [default: all]
  --preset <name>     Benchmark preset (quick, standard, stress) [default: standard]
  --label <name>      Label for this benchmark run
  --save              Save results to storage
  --clinic <tool>     Run with clinic.js profiling (doctor, flame, bubbleprof)
  --otel-path <path>  Path to opentelemetry-js repo [default: ~/workspace/opentelemetry-js]

Compare Options:
  --baseline <id>     Baseline result ID or label
  --target <id>       Target result ID or label
  --format <type>     Output format (table, json, markdown) [default: table]
  --app <name>        Filter by app (express, fastify)
  --scenario <name>   Filter by scenario
  --mode <name>       Filter by instrumentation mode

Export Options:
  --id <id>           Result ID to export
  --format <type>     Export format (json, csv, markdown) [default: json]
  --output <path>     Output file path

Report Options:
  --baseline <id>     Baseline result ID or label
  --target <id>       Target result ID or label
  --create-issue      Create a GitHub issue with results
  --artifact-url <url> URL to artifact downloads
  --pr <number>       Related PR number

Examples:
  otel-perf run --app express --preset quick --label "main-branch" --save
  otel-perf run --app all --mode all --scenario simple-json --save
  otel-perf compare --baseline main-branch --target pr-123
  otel-perf export --id main-branch --format markdown --output report.md
  otel-perf report --baseline v1.26.0 --target pr-123 --create-issue
`);
}

async function main() {
  try {
    switch (command) {
      case 'run':
        await runCommand(args.slice(1));
        break;
      case 'compare':
        await compareCommand(args.slice(1));
        break;
      case 'list':
        await listCommand(args.slice(1));
        break;
      case 'export':
        await exportCommand(args.slice(1));
        break;
      case 'report':
        await reportCommand(args.slice(1));
        break;
      case 'rebuild-index':
        await rebuildIndexCommand(args.slice(1));
        break;
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;
      default:
        if (command) {
          console.error(`Unknown command: ${command}`);
        }
        printHelp();
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

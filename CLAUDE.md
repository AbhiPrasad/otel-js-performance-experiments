# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Performance testing framework for benchmarking OpenTelemetry JavaScript instrumentation. Tests Express and Fastify servers with various instrumentation modes using autocannon load testing and clinic.js profiling.

**Requirements**: Node.js 24+

## Common Commands

```bash
# Build all packages
npm run build

# Run linting
npm run lint

# Run tests
npm run test

# Clean dist directories
npm run clean

# Run a benchmark
npm run cli -- run --app express --preset quick --label "test" --save

# Compare two benchmark results
npm run cli -- compare --baseline <baseline-id> --target <target-id>

# Export results (json, csv, markdown)
npm run cli -- export --id <result-id> --format markdown --output report.md

# List stored results
npm run cli -- list

# Rebuild results index (after merging artifacts)
npm run cli -- rebuild-index

# Test a PR against latest release (from opentelemetry-js repo)
./scripts/test-pr.sh <pr-number> --app express --preset standard
```

## Architecture

**Monorepo Structure** (npm workspaces):
- `packages/cli` - CLI entry point, command handlers (run, compare, list, export, report)
- `packages/benchmark-runner` - Autocannon load testing + clinic.js profiling integration
- `packages/results-store` - JSON-based result storage, comparison logic, exporters
- `packages/otel-linker` - Git operations, builds, and npm linking for opentelemetry-js packages
- `packages/github-reporter` - GitHub issue creation with benchmark comparisons
- `apps/express-app` - Express test server (port 3000)
- `apps/fastify-app` - Fastify test server (port 3000)
- `config/scenarios.ts` - Test scenarios, instrumentation modes, benchmark presets

**Key Patterns**:
- ESM modules throughout (use `.js` extensions in imports)
- TypeScript with ES2022 target, NodeNext module resolution
- Each package has `src/` compiled to `dist/`
- Internal packages use `@otel-perf/` namespace
- Turborepo manages build orchestration (respects package dependency order)

## GitHub Actions

**CI Workflow** (`.github/workflows/ci.yml`):
- Runs on push to `main` and PRs
- Builds all packages, runs lint
- Caches npm dependencies and Turborepo build outputs

**Benchmark Workflow** (`.github/workflows/benchmark.yml`):
- Manually triggered via `workflow_dispatch`
- Jobs: `setup` → `build-baseline` + `build-pr` → `benchmark-baseline` + `benchmark-pr` → `compare`
- otel-js built once per version, uploaded as artifact
- Benchmarks sharded by app × mode matrix
- Baseline benchmarks start immediately when baseline build completes (don't wait for PR build)
- `rebuild-index` CLI command merges results from parallel artifact uploads

## Test Configuration

**Scenarios**: simple-json, async-io-50ms, async-io-100ms, cpu-work-light, cpu-work-heavy, external-http-single, nested-spans, complex-attributes, post-json-small

**Instrumentation Modes**:
- `baseline` - No OTel instrumentation
- `otel-noop` - NoopSpanProcessor (SDK overhead only)
- `otel-console` - ConsoleSpanExporter
- `otel-otlp-http` - OTLP HTTP exporter

**Presets**: quick (10s), standard (30s), stress (60s), sustained (300s)

## Testing

Unit tests use Vitest. Tests are colocated with source files (`*.test.ts`).

```bash
# Run all tests
npm run test

# Run tests for a specific package
cd packages/results-store && npm test
cd packages/cli && npm test
```

**Tested modules**:
- `packages/results-store/src/comparison.ts` - `compareResults()`, `calculateDiff()`, formatting utilities
- `packages/results-store/src/storage.ts` - `ResultsStorage` class (save, load, delete, rebuildIndex)
- `packages/cli/src/utils.ts` - `parseArgs()`, `expandPath()`, `formatDuration()`

## Environment Variables

- `OTEL_JS_PATH` - Path to opentelemetry-js repo (default: ~/workspace/opentelemetry-js)
- `GITHUB_TOKEN` - Required for GitHub issue creation
- `MOCK_SERVER_PORT` - Mock server for external call tests (default: 3001)

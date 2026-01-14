# OpenTelemetry JS Performance Experiments

A comprehensive performance testing project for benchmarking OpenTelemetry JavaScript instrumentation across Express and Fastify web servers.

## Features

- **Test Applications**: Express and Fastify apps with various test scenarios
- **Benchmarking**: autocannon-based load testing with configurable presets
- **Profiling**: clinic.js integration for CPU, memory, and event loop analysis
- **PR Testing**: Compare performance between otel-js PRs and latest releases
- **Results Management**: Store, compare, and export benchmark results
- **GitHub Integration**: Automated CI workflow with GitHub issue creation

## Prerequisites

- Node.js 20+
- opentelemetry-js repo cloned locally (default: `~/workspace/opentelemetry-js`)

## Quick Start

```bash
# Clone this repository
git clone <repo-url> otel-js-performance-experiments
cd otel-js-performance-experiments

# Run setup
./scripts/setup.sh

# Run a quick benchmark
npm run cli -- run --app express --preset quick --save

# List results
npm run cli -- list
```

## CLI Commands

### Run Benchmarks

```bash
# Quick test on Express
npm run cli -- run --app express --preset quick --label "test-run" --save

# Full test suite on all apps
npm run cli -- run --app all --mode all --scenario all --preset standard --save

# With clinic.js profiling
npm run cli -- run --app express --preset quick --clinic flame --save
```

### Compare Results

```bash
# Compare two benchmark runs
npm run cli -- compare --baseline main-branch --target pr-123

# Output as markdown
npm run cli -- compare --baseline v1.26.0 --target pr-123 --format markdown
```

### Export Results

```bash
# Export to JSON
npm run cli -- export --id my-label --format json --output results.json

# Export to markdown report
npm run cli -- export --id my-label --format markdown --output report.md
```

### Create GitHub Issue

```bash
# Generate comparison report and create issue
GITHUB_TOKEN=your-token npm run cli -- report \
  --baseline v1.26.0 \
  --target pr-123 \
  --create-issue
```

## Testing a PR

Use the provided script to test a PR against the latest release:

```bash
./scripts/test-pr.sh 12345

# With options
./scripts/test-pr.sh 12345 --app fastify --preset stress
```

## GitHub Actions

Manually trigger the benchmark workflow:

1. Go to Actions → "Performance Benchmark"
2. Click "Run workflow"
3. Enter the PR number
4. Monitor the workflow

The workflow will:
- Benchmark the latest release as baseline
- Benchmark the PR
- Create a GitHub issue with comparison results
- Upload benchmark artifacts

## Project Structure

```
otel-js-performance-experiments/
├── apps/
│   ├── express-app/          # Express test application
│   └── fastify-app/          # Fastify test application
├── packages/
│   ├── benchmark-runner/     # autocannon + clinic.js integration
│   ├── otel-linker/          # Git/build/link management
│   ├── results-store/        # Results storage and comparison
│   ├── github-reporter/      # GitHub issue creation
│   └── cli/                  # CLI application
├── scripts/
│   ├── setup.sh              # Project setup
│   ├── test-pr.sh            # PR testing script
│   └── mock-server.js        # Mock server for external calls
├── config/
│   └── scenarios.ts          # Test scenario definitions
└── results/                  # Stored benchmark results
```

## Test Scenarios

| Scenario | Description |
|----------|-------------|
| `simple-json` | Basic JSON response |
| `async-io-50ms` | Simulated 50ms async I/O |
| `cpu-work-light` | Light CPU-bound work |
| `external-http-*` | External HTTP calls |
| `nested-spans` | Manual nested spans |

## Instrumentation Modes

| Mode | Description |
|------|-------------|
| `baseline` | No OpenTelemetry |
| `otel-noop` | OTel with NoopSpanProcessor |
| `otel-console` | OTel with ConsoleSpanExporter |
| `otel-otlp-http` | OTel with OTLP HTTP exporter |

## Benchmark Presets

| Preset | Connections | Duration |
|--------|-------------|----------|
| `quick` | 10 | 10s |
| `standard` | 50 | 30s |
| `stress` | 100 | 60s |
| `sustained` | 25 | 300s |

## Configuration

Set environment variables:

```bash
# Path to opentelemetry-js repo
export OTEL_JS_PATH=~/workspace/opentelemetry-js

# GitHub token for issue creation
export GITHUB_TOKEN=your-token
```

## Development

```bash
# Build all packages
npm run build

# Run CLI in development
node packages/cli/dist/index.js run --help
```

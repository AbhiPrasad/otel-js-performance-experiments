#!/bin/bash
set -e

# Setup script for otel-js-performance-experiments
# This script installs dependencies and builds all packages

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "OpenTelemetry JS Performance Experiments"
echo "Setup Script"
echo "=========================================="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20+ is required (found: $(node -v))"
    exit 1
fi
echo "Node.js version: $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build all packages
echo ""
echo "Building packages..."
npm run build

# Create results directories
echo ""
echo "Creating results directories..."
mkdir -p results/benchmarks
mkdir -p results/clinic-reports
mkdir -p results/comparisons

# Verify opentelemetry-js repo
OTEL_JS_PATH="${OTEL_JS_PATH:-$HOME/workspace/opentelemetry-js}"
if [ -d "$OTEL_JS_PATH" ]; then
    echo ""
    echo "Found opentelemetry-js at: $OTEL_JS_PATH"
    cd "$OTEL_JS_PATH"
    OTEL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    OTEL_COMMIT=$(git rev-parse --short HEAD)
    echo "  Branch: $OTEL_BRANCH"
    echo "  Commit: $OTEL_COMMIT"
else
    echo ""
    echo "Warning: opentelemetry-js not found at $OTEL_JS_PATH"
    echo "Clone it with:"
    echo "  git clone https://github.com/open-telemetry/opentelemetry-js.git $OTEL_JS_PATH"
fi

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Quick start:"
echo "  npm run cli -- run --app express --preset quick --save"
echo "  npm run cli -- list"
echo ""
echo "Test a PR:"
echo "  ./scripts/test-pr.sh <PR_NUMBER>"

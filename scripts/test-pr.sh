#!/bin/bash
set -e

# Test a PR from opentelemetry-js against the latest release
# Usage: ./scripts/test-pr.sh <PR_NUMBER> [OPTIONS]

PR_NUMBER=$1
OTEL_JS_PATH="${OTEL_JS_PATH:-$HOME/workspace/opentelemetry-js}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$PR_NUMBER" ]; then
    echo "Usage: $0 <PR_NUMBER> [--app <express|fastify|all>] [--preset <quick|standard|stress>]"
    echo ""
    echo "Environment variables:"
    echo "  OTEL_JS_PATH  Path to opentelemetry-js repo (default: ~/workspace/opentelemetry-js)"
    exit 1
fi

# Parse optional arguments
APP="express"
PRESET="standard"
SCENARIO="simple-json"

shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --app)
            APP="$2"
            shift 2
            ;;
        --preset)
            PRESET="$2"
            shift 2
            ;;
        --scenario)
            SCENARIO="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo "=========================================="
echo "OpenTelemetry JS Performance Test"
echo "=========================================="
echo "PR Number:    #$PR_NUMBER"
echo "OTel JS Path: $OTEL_JS_PATH"
echo "App:          $APP"
echo "Preset:       $PRESET"
echo "Scenario:     $SCENARIO"
echo "=========================================="

# Check if otel-js repo exists
if [ ! -d "$OTEL_JS_PATH" ]; then
    echo "Error: opentelemetry-js repo not found at $OTEL_JS_PATH"
    exit 1
fi

# Save current branch
cd "$OTEL_JS_PATH"
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
ORIGINAL_COMMIT=$(git rev-parse HEAD)
echo ""
echo "Current branch: $ORIGINAL_BRANCH ($ORIGINAL_COMMIT)"

# Get latest tag for baseline
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "main")
echo "Latest release: $LATEST_TAG"

# Stash any changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Stashing uncommitted changes..."
    git stash
    STASHED=1
fi

echo ""
echo "=========================================="
echo "Step 1: Benchmark baseline ($LATEST_TAG)"
echo "=========================================="

git checkout "$LATEST_TAG"
npm ci
npm run compile

cd "$PROJECT_ROOT"
npm run cli -- run \
    --app "$APP" \
    --scenario "$SCENARIO" \
    --preset "$PRESET" \
    --label "baseline-$LATEST_TAG" \
    --otel-path "$OTEL_JS_PATH" \
    --save

echo ""
echo "=========================================="
echo "Step 2: Fetch and checkout PR #$PR_NUMBER"
echo "=========================================="

cd "$OTEL_JS_PATH"
git fetch origin "pull/$PR_NUMBER/head:pr-$PR_NUMBER"
git checkout "pr-$PR_NUMBER"
PR_COMMIT=$(git rev-parse --short HEAD)
echo "PR commit: $PR_COMMIT"

echo ""
echo "=========================================="
echo "Step 3: Build PR branch"
echo "=========================================="

npm ci
npm run compile

echo ""
echo "=========================================="
echo "Step 4: Benchmark PR #$PR_NUMBER"
echo "=========================================="

cd "$PROJECT_ROOT"
npm run cli -- run \
    --app "$APP" \
    --scenario "$SCENARIO" \
    --preset "$PRESET" \
    --label "pr-$PR_NUMBER" \
    --otel-path "$OTEL_JS_PATH" \
    --save

echo ""
echo "=========================================="
echo "Step 5: Compare results"
echo "=========================================="

npm run cli -- compare \
    --baseline "baseline-$LATEST_TAG" \
    --target "pr-$PR_NUMBER"

echo ""
echo "=========================================="
echo "Step 6: Restore original branch"
echo "=========================================="

cd "$OTEL_JS_PATH"
git checkout "$ORIGINAL_BRANCH"

# Restore stashed changes if any
if [ -n "$STASHED" ]; then
    echo "Restoring stashed changes..."
    git stash pop || true
fi

echo ""
echo "=========================================="
echo "Complete!"
echo "=========================================="
echo ""
echo "Results saved with labels:"
echo "  - baseline-$LATEST_TAG"
echo "  - pr-$PR_NUMBER"
echo ""
echo "To export results:"
echo "  npm run cli -- export --id pr-$PR_NUMBER --format markdown --output report.md"

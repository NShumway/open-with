#!/bin/bash
set -e

# Reclaim Open With - Build Script
# Builds both the extension and native host

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Building Reclaim Open With..."

# Build extension
echo "Building extension..."
cd "$PROJECT_ROOT/extension"
npm ci
npm run build

# Build native host
echo "Building native host..."
cd "$PROJECT_ROOT/native-host"
make build

echo "Build complete!"
echo "Extension: extension/dist/"
echo "Native host: native-host/bin/"

#!/bin/bash
set -e

echo "Building Reclaim: Open With..."

# Build native host
echo "→ Building native host..."
cd native-host
go build -o reclaim-openwith ./cmd/reclaim-openwith
cd ..

# Build extension
echo "→ Building extension..."
cd extension
npm run build
cd ..

echo "✓ Build complete"

#!/bin/bash
set -e

# Install native messaging host for macOS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

HOST_NAME="com.reclaim.openwith"
BINARY_NAME="reclaim-openwith"
BINARY_PATH="$PROJECT_ROOT/native-host/bin/$BINARY_NAME"

# Native messaging host directories
CHROME_HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
CHROMIUM_HOST_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"

# Create host manifest
create_manifest() {
    local extension_id="$1"
    cat << EOF
{
  "name": "$HOST_NAME",
  "description": "Reclaim Open With native messaging host",
  "path": "$BINARY_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$extension_id/"
  ]
}
EOF
}

# Install for Chrome
install_chrome() {
    local extension_id="$1"
    mkdir -p "$CHROME_HOST_DIR"
    create_manifest "$extension_id" > "$CHROME_HOST_DIR/$HOST_NAME.json"
    echo "Installed native host for Chrome"
}

# Install for Chromium
install_chromium() {
    local extension_id="$1"
    mkdir -p "$CHROMIUM_HOST_DIR"
    create_manifest "$extension_id" > "$CHROMIUM_HOST_DIR/$HOST_NAME.json"
    echo "Installed native host for Chromium"
}

# Main
if [ -z "$1" ]; then
    echo "Usage: $0 <extension-id>"
    echo "Get the extension ID from chrome://extensions after loading the extension"
    exit 1
fi

EXTENSION_ID="$1"

if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Native host binary not found at $BINARY_PATH"
    echo "Run 'make build' in native-host/ first"
    exit 1
fi

install_chrome "$EXTENSION_ID"
install_chromium "$EXTENSION_ID"

echo "Installation complete!"

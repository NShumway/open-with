#!/bin/bash
set -e

# Reclaim: Open With - Package Builder
# Creates a macOS .pkg installer for distribution

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

VERSION="${VERSION:-1.0.0}"
IDENTIFIER="com.reclaim.openwith"
OUTPUT_DIR="$SCRIPT_DIR/dist"
NATIVE_HOST_DIR="$PROJECT_ROOT/native-host"
BINARY_NAME="reclaim-openwith"

# Parse arguments
BUILD_UNIVERSAL=false
SIGN_PACKAGE=false
DEVELOPER_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --universal)
            BUILD_UNIVERSAL=true
            shift
            ;;
        --sign)
            SIGN_PACKAGE=true
            DEVELOPER_ID="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--universal] [--sign <Developer ID>] [--version <version>]"
            exit 1
            ;;
    esac
done

echo "Building Reclaim: Open With installer v${VERSION}..."

# Clean up previous build
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/root/usr/local/bin"
mkdir -p "$OUTPUT_DIR/scripts"

# Build the Go binary
echo "Building native host binary..."
cd "$NATIVE_HOST_DIR"

if [ "$BUILD_UNIVERSAL" = true ]; then
    echo "Building universal binary (amd64 + arm64)..."

    # Build for both architectures
    CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o "bin/${BINARY_NAME}-amd64" ./cmd/reclaim-openwith
    CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o "bin/${BINARY_NAME}-arm64" ./cmd/reclaim-openwith

    # Create universal binary with lipo
    lipo -create -output "bin/${BINARY_NAME}" "bin/${BINARY_NAME}-amd64" "bin/${BINARY_NAME}-arm64"

    # Clean up architecture-specific binaries
    rm -f "bin/${BINARY_NAME}-amd64" "bin/${BINARY_NAME}-arm64"

    echo "Created universal binary"
else
    # Build for current architecture only
    make build
fi

cd "$SCRIPT_DIR"

# Copy binary to package root
cp "$NATIVE_HOST_DIR/bin/$BINARY_NAME" "$OUTPUT_DIR/root/usr/local/bin/"
chmod 755 "$OUTPUT_DIR/root/usr/local/bin/$BINARY_NAME"

# Copy scripts (including common.sh which is sourced by pre/postinstall)
cp "$SCRIPT_DIR/scripts/common.sh" "$OUTPUT_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/preinstall" "$OUTPUT_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/postinstall" "$OUTPUT_DIR/scripts/"
chmod 755 "$OUTPUT_DIR/scripts/common.sh"
chmod 755 "$OUTPUT_DIR/scripts/preinstall"
chmod 755 "$OUTPUT_DIR/scripts/postinstall"

# Build the package
PKG_NAME="reclaim-openwith-${VERSION}.pkg"
echo "Building package: $PKG_NAME"

pkgbuild \
    --root "$OUTPUT_DIR/root" \
    --identifier "$IDENTIFIER" \
    --version "$VERSION" \
    --scripts "$OUTPUT_DIR/scripts" \
    --install-location "/" \
    "$OUTPUT_DIR/$PKG_NAME"

# Sign the package if requested
if [ "$SIGN_PACKAGE" = true ] && [ -n "$DEVELOPER_ID" ]; then
    echo "Signing package with: $DEVELOPER_ID"
    SIGNED_PKG_NAME="reclaim-openwith-${VERSION}-signed.pkg"

    productsign \
        --sign "$DEVELOPER_ID" \
        "$OUTPUT_DIR/$PKG_NAME" \
        "$OUTPUT_DIR/$SIGNED_PKG_NAME"

    # Replace unsigned with signed
    mv "$OUTPUT_DIR/$SIGNED_PKG_NAME" "$OUTPUT_DIR/$PKG_NAME"
    echo "Package signed successfully"
fi

# Clean up intermediate files
rm -rf "$OUTPUT_DIR/root" "$OUTPUT_DIR/scripts"

echo ""
echo "Package built successfully!"
echo "Output: $OUTPUT_DIR/$PKG_NAME"
echo ""
echo "To install:"
echo "  sudo installer -pkg $OUTPUT_DIR/$PKG_NAME -target /"
echo ""
echo "To verify contents:"
echo "  pkgutil --payload-files $OUTPUT_DIR/$PKG_NAME"

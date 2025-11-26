#!/bin/bash
set -e

# Reclaim: Open With - Uninstaller
# Removes the native host binary and all manifests

BINARY_PATH="/usr/local/bin/reclaim-openwith"
MANIFEST_NAME="com.reclaim.openwith.json"
IDENTIFIER="com.reclaim.openwith"

echo "Uninstalling Reclaim: Open With..."

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo $0"
    exit 1
fi

# Remove binary
if [ -f "$BINARY_PATH" ]; then
    rm -f "$BINARY_PATH"
    echo "Removed binary: $BINARY_PATH"
else
    echo "Binary not found (already removed?): $BINARY_PATH"
fi

# Get all user home directories
get_user_homes() {
    dscl . -list /Users UniqueID | while read user uid; do
        if [ "$uid" -ge 500 ] 2>/dev/null; then
            user_home=$(dscl . -read /Users/"$user" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
            if [ -d "$user_home" ]; then
                echo "$user_home"
            fi
        fi
    done
}

# Remove manifests from all browser directories
remove_manifests() {
    local user_home="$1"

    local browsers=(
        "$user_home/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        "$user_home/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
        "$user_home/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
        "$user_home/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
        "$user_home/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
        "$user_home/Library/Application Support/Chromium/NativeMessagingHosts"
        "$user_home/Library/Application Support/Vivaldi/NativeMessagingHosts"
        "$user_home/Library/Application Support/Arc/User Data/NativeMessagingHosts"
    )

    for browser_dir in "${browsers[@]}"; do
        local manifest_path="$browser_dir/$MANIFEST_NAME"
        if [ -f "$manifest_path" ]; then
            rm -f "$manifest_path"
            echo "Removed manifest: $manifest_path"
        fi
    done
}

# Remove from all users
for user_home in $(get_user_homes); do
    echo "Cleaning up for user: $user_home"
    remove_manifests "$user_home"
done

# Forget the package receipt (so macOS doesn't think it's still installed)
if pkgutil --pkg-info "$IDENTIFIER" >/dev/null 2>&1; then
    pkgutil --forget "$IDENTIFIER"
    echo "Removed package receipt"
fi

echo ""
echo "Uninstallation complete!"
echo "You can also remove the Chrome extension from chrome://extensions"

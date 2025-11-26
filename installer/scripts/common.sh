#!/bin/bash
# Reclaim: Open With - Common functions for installer scripts

BINARY_PATH="/usr/local/bin/reclaim-openwith"
MANIFEST_NAME="com.reclaim.openwith.json"

# Browser native messaging host directories (relative to user home)
BROWSER_DIRS=(
    "Library/Application Support/Google/Chrome/NativeMessagingHosts"
    "Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
    "Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
    "Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    "Library/Application Support/Chromium/NativeMessagingHosts"
    "Library/Application Support/Vivaldi/NativeMessagingHosts"
    "Library/Application Support/Arc/User Data/NativeMessagingHosts"
)

# Get all user home directories (for multi-user systems)
# In pkg postinstall, $HOME is /var/root, so we need to find actual users
get_user_homes() {
    # Get users with UID >= 500 (regular users on macOS)
    dscl . -list /Users UniqueID | while read user uid; do
        if [ "$uid" -ge 500 ] 2>/dev/null; then
            user_home=$(dscl . -read /Users/"$user" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
            if [ -d "$user_home" ]; then
                echo "$user_home"
            fi
        fi
    done
}

# Get full browser directory paths for a user
get_browser_paths() {
    local user_home="$1"
    for browser_dir in "${BROWSER_DIRS[@]}"; do
        echo "$user_home/$browser_dir"
    done
}

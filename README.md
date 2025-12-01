# Reclaim: Open With

Quickly open cloud documents in desktop applications.

## Supported Services (V1.5)

| Service | File Types | Status |
|---------|-----------|--------|
| Google Workspace | Docs, Sheets, Slides | Supported |
| Dropbox | All office formats | Supported |
| Box | All office formats | Supported |
| OneDrive/SharePoint | - | Planned for V2 |

## Features

- Click the toolbar icon on any supported document to open it locally
- Works with Google Sheets, Docs, Slides, Dropbox, and Box
- Works with Chrome, Brave, Edge, Chromium, Vivaldi, and Arc
- No data collection or external servers
- Privacy-focused: only activates when you click the icon

## Usage

1. Navigate to any supported document:
   - Google Docs/Sheets/Slides
   - Dropbox file preview or shared link
   - Box file viewer
2. Click the extension icon in the toolbar
3. Click "Open" in the confirmation popup
4. The document downloads and opens in your default desktop application

## How It Works

### Google Workspace
- Exports document using Google's export API
- Downloads to your Downloads folder
- Opens with default application

### Dropbox
- Uses direct download link (adds `?dl=1` parameter)
- Downloads to your Downloads folder
- Opens with default application

### Box
- Clicks native download button via content script
- Downloads and opens in default application

## Building from Source

### Prerequisites

- macOS (only platform tested)
- [Node.js](https://nodejs.org/) 18+ and npm
- [Go](https://go.dev/) 1.21+

### 1. Build the Extension

```bash
cd extension
npm install
npm run build
```

This creates the built extension in `extension/dist/`.

### 2. Build the Native Host

```bash
cd native-host
make build
```

This creates the binary at `native-host/bin/reclaim-openwith`.

### 3. Load the Extension in Chrome

1. Open `chrome://extensions` in your browser
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension` directory (not `extension/dist`)
5. Note the **Extension ID** shown on the card (e.g., `mjckmmbohfpikiaplhcjmjcjeicenmih`)

### 4. Install the Native Messaging Host

The native host must be installed separately — Chrome doesn't do this automatically.

```bash
./installer/scripts/install-host-macos.sh <your-extension-id>
```

Replace `<your-extension-id>` with the ID from step 3.

This installs the manifest file that tells Chrome where to find the native host binary. The manifest is placed in:
- Chrome: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Chromium: `~/Library/Application Support/Chromium/NativeMessagingHosts/`

### 5. Test It

1. Navigate to any supported document (Google Docs, Dropbox, or Box)
2. Click the extension icon in the toolbar
3. Click "Open" in the popup
4. The document downloads and opens in your default desktop application

## Troubleshooting

### Service-Specific Issues

**Dropbox:**
- Shared links must allow downloads (not view-only)
- Password-protected shares require password entry in browser first

**Box:**
- Enterprise accounts may have download restrictions
- Some files require specific permissions

**Google Workspace:**
- "Downloads disabled by owner" error: The document owner has disabled downloads. Use File > Download from the Google Docs menu instead.

### General Issues

**Popup shows "Not supported":**
- Verify you're on a document page (not homepage)
- Check that the service is in the supported list above
- The URL should contain a document/file ID

**File doesn't open:**
Check that you have a default application set for the file type:
1. Download any .xlsx/.docx/.pptx file manually
2. Right-click the file > Get Info
3. Under "Open With", select your preferred app
4. Click "Change All..." to set as default

**"Native host not found" error:**
The native messaging host may not be installed correctly:
```bash
# Check if manifest exists (Chrome)
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.reclaim.openwith.json

# The manifest should point to the binary - verify that path exists
```

If missing, run the install script with your extension ID:
```bash
./installer/scripts/install-host-macos.sh <your-extension-id>
```

## Uninstallation

```bash
sudo ./installer/uninstall.sh
```

Then remove the extension from `chrome://extensions`.

## Development

### Running Tests

```bash
# Extension tests
cd extension && npm test

# Native host tests
cd native-host && make test
```

### Project Structure

```
.
├── extension/           # Chrome extension (TypeScript)
│   ├── src/
│   │   ├── background/  # Service worker and service handlers
│   │   │   └── services/  # Service-specific handlers (Google, Dropbox, Box)
│   │   ├── popup/       # Toolbar popup UI
│   │   └── types/       # TypeScript definitions
│   ├── dist/            # Built extension
│   └── manifest.json
├── native-host/         # Native messaging host (Go)
│   ├── cmd/             # Entry point
│   ├── internal/        # Core packages
│   └── bin/             # Built binary
└── installer/           # macOS installer
    ├── scripts/         # Install/uninstall scripts
    └── dist/            # Built .pkg files
```

## Privacy

This extension:
- Only activates when you click the toolbar icon
- Works on supported document pages only
- Does not collect any user data
- Does not send data to external servers
- Uses your existing session for downloads
- All processing happens locally on your machine

## Version History

- **V1.5**: Added Dropbox and Box support
- **V1**: Initial release with Google Workspace support

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

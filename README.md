# Reclaim: Open With

A Chrome extension that opens Google Docs, Sheets, and Slides in your desktop applications with a single right-click.

## Features

- Right-click any Google Workspace document to open it in your default desktop app
- Supports Google Sheets, Docs, and Slides
- Works with Chrome, Brave, Edge, Chromium, Vivaldi, and Arc
- Native macOS integration
- No data collection or external servers

## Installation

### 1. Install the Native Host

Download and run the installer package:

```bash
sudo installer -pkg reclaim-openwith-1.0.0.pkg -target /
```

Or build from source:

```bash
cd installer
./build-pkg.sh --universal
sudo installer -pkg dist/reclaim-openwith-1.0.0.pkg -target /
```

### 2. Install the Chrome Extension

**From Chrome Web Store** (recommended):
- Visit the [Chrome Web Store listing](#) and click "Add to Chrome"

**For Development**:
1. Open `chrome://extensions` in your browser
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/dist` directory
5. Note the extension ID shown on the card
6. Run the host installer script with your extension ID:
   ```bash
   ./installer/scripts/install-host-macos.sh <your-extension-id>
   ```

## Usage

1. Navigate to any Google Doc, Sheet, or Slide
2. Right-click anywhere on the page
3. Click "Open in [App Name]" (e.g., "Open in Microsoft Excel")
4. The document downloads and opens in your default desktop application

## Supported Services

| Google Service | Opens With |
|----------------|------------|
| Google Sheets  | Excel, Numbers, or your default .xlsx app |
| Google Docs    | Word, Pages, or your default .docx app |
| Google Slides  | PowerPoint, Keynote, or your default .pptx app |

## How It Works

1. The extension detects when you're viewing a Google Workspace document
2. On right-click, it shows a context menu with the default app for that file type
3. When clicked, the extension:
   - Exports the document using Google's export API
   - Downloads the file to your Downloads folder
   - Sends the file path to the native host
   - The native host opens the file with your default application

## Troubleshooting

### "Downloads disabled by owner" error
The document owner has disabled downloads. Use File > Download from the Google Docs menu instead.

### No context menu appears
- Verify the extension is enabled at `chrome://extensions`
- Refresh the page
- Check that you're on a Google Docs/Sheets/Slides URL

### File doesn't open
Check that you have a default application set for the file type:
1. Download any .xlsx/.docx/.pptx file manually
2. Right-click the file > Get Info
3. Under "Open With", select your preferred app
4. Click "Change All..." to set as default

### "Native host not found" error
The native messaging host may not be installed correctly:
```bash
# Check if binary exists
ls -la /usr/local/bin/reclaim-openwith

# Check if manifest exists (Chrome example)
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.reclaim.openwith.json
```

If missing, reinstall the package or run the install script manually.

## Uninstallation

```bash
sudo ./installer/uninstall.sh
```

Then remove the extension from `chrome://extensions`.

## Development

### Prerequisites

- Node.js 18+
- Go 1.21+
- macOS (for native host)

### Building

```bash
# Build everything
./installer/build.sh

# Build extension only
cd extension && npm run build

# Build native host only
cd native-host && make build

# Run tests
cd extension && npm test
cd native-host && make test
```

### Project Structure

```
.
├── extension/           # Chrome extension (TypeScript)
│   ├── src/
│   │   ├── background/  # Service worker
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
- Only activates on Google Docs URLs (`docs.google.com`)
- Does not collect any user data
- Does not send data to external servers
- Uses your existing Google session for downloads
- All processing happens locally on your machine

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

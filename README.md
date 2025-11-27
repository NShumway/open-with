# Reclaim: Open With

Quickly open Google Docs, Sheets, and Slides locally.

## Project Status

| Version | Description | Status |
|---------|-------------|--------|
| **V1** | Google Workspace (Sheets, Docs, Slides) via toolbar popup | ✅ Built |
| **V1.5** | Additional providers (Office 365, Box, Confluence) | 📋 Planned |
| **V2** | Content extraction from any page (tables, text, clean PDFs) | 📋 Planned |

See [PRD-overview.md](PRD-overview.md) for the full roadmap.

## Features (V1)

- Click the toolbar icon on any Google Workspace document to open it locally
- Supports Google Sheets, Docs, and Slides
- Works with Chrome, Brave, Edge, Chromium, Vivaldi, and Arc
- No data collection or external servers

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

1. Navigate to any Google Doc, Sheet, or Slide
2. Click the extension icon in the toolbar
3. Click "Open" in the popup
4. The document downloads and opens in your default desktop application

## Usage

1. Navigate to any Google Doc, Sheet, or Slide
2. Click the extension icon in the toolbar
3. Click "Open" in the confirmation popup
4. The document downloads and opens in your default desktop application

## Supported Services

| Google Service | Opens With |
|----------------|------------|
| Google Sheets  | Excel, Numbers, or your default .xlsx app |
| Google Docs    | Word, Pages, or your default .docx app |
| Google Slides  | PowerPoint, Keynote, or your default .pptx app |

## How It Works

1. When you click the toolbar icon, the popup detects if you're on a supported Google Workspace page
2. If supported, it shows a confirmation with the document name and file type
3. When you click "Open", the extension:
   - Exports the document using Google's export API
   - Downloads the file to your Downloads folder
   - Sends the file path to the native messaging host
   - The native host opens the file with your default application

## Troubleshooting

### "Downloads disabled by owner" error
The document owner has disabled downloads. Use File > Download from the Google Docs menu instead.

### Popup shows "Not supported"
- Check that you're on a Google Docs/Sheets/Slides document URL (not the homepage)
- The URL should look like `docs.google.com/spreadsheets/d/...` or similar

### File doesn't open
Check that you have a default application set for the file type:
1. Download any .xlsx/.docx/.pptx file manually
2. Right-click the file > Get Info
3. Under "Open With", select your preferred app
4. Click "Change All..." to set as default

### "Native host not found" error
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
│   │   ├── background/  # Service worker
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
- Only activates on Google Docs URLs (`docs.google.com`)
- Does not collect any user data
- Does not send data to external servers
- Uses your existing Google session for downloads
- All processing happens locally on your machine

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

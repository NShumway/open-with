# Reclaim: Open With — V1 PRD

**Scope:** Google Workspace only (Sheets, Docs, Slides)

---

## Overview

V1 delivers a single-click experience to open Google Workspace documents in desktop applications. Right-click a Google Doc, Sheet, or Slide → "Open in [App]" → file downloads and opens in the user's default application.

## Goals

- One-click export from Google Docs, Sheets, and Slides
- Opens in system default application for each file type
- File set to read-only to trigger "Save As" behavior (not overwrite)
- Works on Chrome, Brave, Edge, Arc, and other Chromium browsers
- macOS only (architecture supports cross-platform, but V1 ships macOS due to testing constraints)

## Non-Goals

- Services requiring OAuth (Office 365, Zoho, etc.) — deferred to V1.5
- Content extraction from arbitrary pages — deferred to V2
- Bypassing view-only restrictions — deferred to V2
- App picker (use system default only)
- Auto-cleanup of downloaded files
- Windows/Linux support

---

## User Experience

**Flow:**

1. User is viewing a Google Doc, Sheet, or Slide
2. User right-clicks anywhere on the page
3. Context menu shows "Open in [App Name]" (e.g., "Open in Microsoft Excel")
4. User clicks the menu item
5. File downloads, moves to temp directory, opens in the desktop app
6. User edits the document
7. On save/close, the app prompts "Save As" (not overwrite)

**Supported Sites:**

| Service | Document Types | Export Format |
|---------|---------------|---------------|
| Google Sheets | Spreadsheets | .xlsx |
| Google Docs | Documents | .docx |
| Google Slides | Presentations | .pptx |

**Error Handling:**

- **403 (view-only with downloads disabled):** Show notification: "The document owner has disabled downloads for this file."
- **No default app:** Show notification explaining how to set a default app, offer to reveal file in Finder.
- **Download timeout (60s):** Show error suggesting manual download via File → Download.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Extension (MV3)                         │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ contextMenus│───►│  downloads  │───►│  nativeMessaging │   │
│  │   API       │    │    API      │    │       API        │   │
│  └─────────────┘    └─────────────┘    └────────┬─────────┘   │
└─────────────────────────────────────────────────┼──────────────┘
                                                  │ JSON/stdio
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Native Messaging Host (Go)                   │
│                                                                 │
│  • Receive file path from extension                             │
│  • Move file from Downloads to temp directory                   │
│  • Set file permissions to read-only (0444)                     │
│  • Query system default app for file type                       │
│  • Launch app with file                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Extension Specification

### Manifest Permissions

```json
{
  "permissions": [
    "contextMenus",
    "downloads",
    "nativeMessaging",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://docs.google.com/*"
  ]
}
```

### Site Registry

```typescript
interface SiteConfig {
  name: string;
  urlPatterns: string[];           // Match patterns for manifest + runtime
  documentIdRegex: RegExp;         // Extract document ID from URL
  exportUrl: (id: string) => string;  // Generate export URL
  fileType: 'xlsx' | 'docx' | 'pptx';
}
```

| Service | URL Pattern | Export URL |
|---------|-------------|------------|
| Google Sheets | `docs.google.com/spreadsheets/d/*` | `https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx` |
| Google Docs | `docs.google.com/document/d/*` | `https://docs.google.com/document/d/{id}/export?format=docx` |
| Google Slides | `docs.google.com/presentation/d/*` | `https://docs.google.com/presentation/d/{id}/export?format=pptx` |

### Context Menu Behavior

1. On extension install, query native host for default app names for each file type
2. Create context menus with dynamic labels:
   - "Open in Microsoft Excel" (if Excel is default for .xlsx)
   - "Open in Numbers" (if Numbers is default for .xlsx)
3. Menu items only appear on matching URL patterns (documentUrlPatterns)

### Download Flow

1. Construct export URL based on document type and ID
2. Call `chrome.downloads.download()` with generated filename
3. Listen for download completion via `chrome.downloads.onChanged`
4. On completion, query `chrome.downloads.search()` for file path
5. Send file path to native host via `chrome.runtime.sendNativeMessage()`

---

## Native Host Specification

### Implementation

Written in **Go** for cross-platform compatibility. Single static binary with no runtime dependencies.

**macOS Implementation:**

| Task | Approach |
|------|----------|
| Get default app | `open -b` or Launch Services API |
| Open file with app | `open` command |
| Temp directory | `os.TempDir()` |
| No default app | Reveal in Finder, show notification |

### Host Manifest

Filename: `com.reclaim.openwith.json`

Installed to (macOS):
- Chrome: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Brave: `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
- Edge: `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/`
- Chromium: `~/Library/Application Support/Chromium/NativeMessagingHosts/`

```json
{
  "name": "com.reclaim.openwith",
  "description": "Reclaim: Open With native helper",
  "path": "/usr/local/bin/reclaim-openwith",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID/"
  ]
}
```

### Message Protocol

**Request: Get Default Apps**
```json
{
  "action": "getDefaults"
}
```

**Response: Default Apps**
```json
{
  "success": true,
  "defaults": {
    "xlsx": { "name": "Microsoft Excel", "bundleId": "com.microsoft.Excel" },
    "docx": { "name": "Microsoft Word", "bundleId": "com.microsoft.Word" },
    "pptx": { "name": "Microsoft PowerPoint", "bundleId": "com.microsoft.Powerpoint" }
  }
}
```

**Request: Open File**
```json
{
  "action": "open",
  "filePath": "/Users/user/Downloads/spreadsheet.xlsx",
  "fileType": "xlsx"
}
```

**Response: Open Result**
```json
{
  "success": true,
  "tempPath": "/var/folders/xx/.../spreadsheet.xlsx"
}
```

**Error Response**
```json
{
  "success": false,
  "error": "no_default_app",
  "fileType": "xlsx"
}
```

### Native Host Operations

**getDefaults:**
1. Query system for default app for .xlsx, .docx, .pptx
2. Resolve to application name
3. Return mapping

**open:**
1. Validate file exists at provided path
2. Generate temp path: `os.TempDir() + original_filename`
3. Move file from Downloads to temp directory
4. Set file permissions to 0444 (read-only)
5. Query system default app for file type
6. If no default app: return error with `no_default_app` code
7. Open file with default app
8. Return success/failure

---

## Installation

### User Steps

1. Install the extension (Chrome Web Store or sideload)
2. Run the installer package (.pkg) which:
   - Installs native host binary to `/usr/local/bin/reclaim-openwith`
   - Installs host manifests to all supported browser locations
   - Sets correct permissions

### Installer Package Contents

```
/usr/local/bin/
  └── reclaim-openwith

~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
  └── com.reclaim.openwith.json

~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/
  └── com.reclaim.openwith.json

~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/
  └── com.reclaim.openwith.json

~/Library/Application Support/Chromium/NativeMessagingHosts/
  └── com.reclaim.openwith.json
```

---

## Security Considerations

- Native host only accepts messages from the specific extension ID
- File operations restricted to moving from Downloads to temp
- Quarantine attribute preserved for Gatekeeper protection
- No network access in native host
- No arbitrary command execution

---

## Success Metrics

- Context menu appears reliably on Google Docs, Sheets, and Slides
- File opens in correct default application within 3 seconds of click
- Application prompts "Save As" on first save (not overwrite to temp)
- Works across Chrome, Brave, Edge, and other Chromium browsers

---

## Open Questions (Resolved)

### Large files?
60-second timeout with visual feedback. Google's export API has its own limits (~10MB for Sheets).

### Progress indicator?
Badge on extension icon during download. Desktop notification only on errors. Success = app opens (self-evident).

### No default app?
macOS: Show notification explaining how to set default, offer to reveal file in Finder.

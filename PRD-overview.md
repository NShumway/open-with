# Reclaim: Open With — Overview

> **Implementation PRDs:**
> - [PRD-v1.md](PRD-v1.md) — Google Workspace (Sheets, Docs, Slides)
> - [PRD-v1.5.md](PRD-v1.5.md) — OAuth services (Office 365, Box, Confluence)
> - [PRD-v2.md](PRD-v2.md) — Wild west extraction (any page)

---

## Overview

**Reclaim: Open With** is a Chrome extension (MV3) with a native messaging host that liberates web content for use in desktop applications. The browser is the user's tool — this extension lets users extract and open web-based documents, tables, and content in their preferred local applications.

*Part of the Reclaim suite — tools that put users back in control of their browser.*

## Problem Statement

Web applications increasingly lock users into browser-based experiences with no easy way to work with content locally. Users face:

1. Document editors (Google Docs, Office Online) that require manual export workflows
2. Data tables on websites with no export functionality
3. Pages cluttered with ads when trying to print or save
4. Content trapped in the browser when users prefer native applications

This extension reclaims user control: right-click → "Open With" for known document sites, or open the discovery modal to extract tables, text, and clean PDFs from any page.

## Goals

- **V1:** Single-click experience to open Google Workspace documents in desktop apps
- **V1.5:** Expand to additional cloud services via user-provided OAuth or authenticated sessions
- **V2:** Content discovery modal to extract tables, text, and clean PDFs from any webpage — including bypassing view-only restrictions
- Use system default applications for each file type (respects user preferences)
- Downloaded file triggers "Save As" behavior on close (not overwrite)
- Works on any Chromium-based browser (Chrome, Brave, Edge, Arc, etc.)

## Non-Goals (V1)

- Selecting from multiple compatible applications (use system default only)
- Cleaning up downloaded files automatically
- Windows/Linux publishing (architecture supports cross-platform, but V1 ships macOS only due to testing constraints)
- Services requiring OAuth (Office 365, Zoho, etc.) — deferred to V1.5

---

## User Experience

### V1: One-Click for Supported Sites

**Flow:**

1. User is viewing a document on a supported site (Google Docs, Office Online, etc.)
2. User right-clicks anywhere on the page
3. Context menu shows "Open in [App Name]" (e.g., "Open in Microsoft Excel")
4. User clicks the menu item
5. File downloads, moves to temp directory, opens in the desktop app
6. User edits the document
7. On save/close, the app prompts "Save As" (not overwrite)

**Supported Sites (V1):**

| Service | Document Types | Export Formats |
|---------|---------------|----------------|
| Google Sheets | Spreadsheets | .xlsx |
| Google Docs | Documents | .docx |
| Google Slides | Presentations | .pptx |

**Context Menu (V1):**

On supported sites, context menu shows:
- "Open in [Default App Name]" (e.g., "Open in Microsoft Excel")

### V1.5: Additional Cloud Services (OAuth Model)

V1.5 expands support to services that require OAuth or more complex authentication. Users who need these services can provide their own API credentials or leverage existing authenticated sessions.

**Candidate Services:**

| Service | Auth Method | Export Approach |
|---------|-------------|-----------------|
| Office 365 / OneDrive | User OAuth via Microsoft Graph API | API download endpoint |
| Box | Session cookies (URLs expire in 15 min) | Direct download with `?download=1` |
| Confluence | Basic Auth or session | PDF export via `flyingpdf` endpoint |
| Zoho Writer/Sheet | OAuth token | API download endpoint |

**Architecture:**
- Extension settings page for OAuth configuration
- Secure token storage in `chrome.storage.local`
- Token refresh handling for long-lived sessions

**Open Questions:**
- Should we provide a "bring your own OAuth app" model, or register our own apps with each provider?
- How to handle token expiration gracefully during export?

---

### V2: Discovery Modal for Any Page

**Flow:**

1. User is on any webpage (not a supported document site)
2. User clicks the extension icon in the toolbar
3. Modal opens showing detected extractable content
4. User selects what they want and clicks to open
5. Content is extracted, converted, and opened in the appropriate app

**Discovery Modal UI:**

```
┌─────────────────────────────────────────────┐
│  Reclaim: Open With                     ✕   │
├─────────────────────────────────────────────┤
│                                             │
│  📄 Page Content                            │
│     ├─ Open as Text (.txt)                  │
│     ├─ Open as Document (.docx)             │
│     └─ Print to PDF (ads removed)           │
│                                             │
│  📊 Tables (3 found)                        │
│     └─ Open all in Excel (.xlsx)            │
│         • "Q3 Revenue" (24 rows)            │
│         • "Regional Data" (12 rows)         │
│         • "Summary" (5 rows)                │
│                                             │
│  ─────────────────────────────────────────  │
│  ℹ️ Tip: On Google Docs and Office Online,  │
│     right-click for one-click export.       │
│                                             │
└─────────────────────────────────────────────┘
```

**Extraction Capabilities (V2):**

| Content Type | Detection Method | Output Format |
|--------------|------------------|---------------|
| Tables | `<table>` elements in DOM | .xlsx (multi-sheet if multiple tables) |
| Page text | `document.body.innerText` | .txt or .docx |
| Clean PDF | DOM clone with ads/nav removed | .pdf |

**Table Extraction Details:**

- All `<table>` elements on page are detected
- Tables are named by: `<caption>`, nearby `<h1-6>`, `aria-label`, or "Table 1/2/3"
- Row count shown for each table
- Multiple tables → multiple sheets in single .xlsx workbook
- Output format is always .xlsx (opens in both Excel and Numbers)

**Clean PDF Details:**

- DOM is cloned
- Ad elements removed using common selectors + EasyList patterns
- Navigation, headers, footers, sidebars optionally removed
- Cleaned DOM rendered to PDF via browser print

**View-Only Bypass (V2):**

When a Google Doc/Sheet/Slide has downloads disabled by the owner, V2 extracts content directly from the rendered DOM:

- **Documents:** Extract text content from the rendered editor DOM
- **Spreadsheets:** Parse the visible grid cells into a table structure
- **Presentations:** Capture slides as rendered (images or text extraction)

This respects the user's right to interact with content served to their browser. If it's rendered, it's extractable.

**Ad Removal Implementation:**

Uses DOM cleanup approach (~50-100ms, imperceptible to user):

```javascript
// Clone DOM, remove ad elements, then print
const adSelectors = [
  '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]',
  '[data-ad]', 'iframe[src*="doubleclick"]',
  '.sponsored', '.advertisement', 'aside.promotions',
  // Extended with EasyList patterns
];
clone.querySelectorAll(adSelectors.join(',')).forEach(el => el.remove());
```

### File Handling

- File downloads to the user's Downloads folder (Chrome API limitation)
- Native host moves file to system temp directory (`/tmp/` or `os.TempDir()`)
- File is set to read-only (mode 0444) to force "Save As" behavior
- macOS quarantine attribute is preserved (set automatically by Chrome on download)

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
│         │                                       │              │
│         │           ┌─────────────┐             │              │
│         └──────────►│   popup     │◄────────────┘              │
│                     │  (V2 modal) │                            │
│                     └─────────────┘                            │
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

## Supported Sites Configuration (V1)

Sites are configured via a hardcoded registry in the extension. Each site definition includes:

```typescript
interface SiteConfig {
  name: string;
  urlPatterns: string[];           // Match patterns for manifest + runtime
  documentIdRegex: RegExp;         // Extract document ID from URL
  exportUrl: (id: string) => string;  // Generate export URL
  fileType: 'xlsx' | 'docx' | 'pptx';
}
```

**Site Registry (V1 — Google Only):**

| Service | URL Pattern | Export URL |
|---------|-------------|------------|
| Google Sheets | `docs.google.com/spreadsheets/d/*` | `https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx` |
| Google Docs | `docs.google.com/document/d/*` | `https://docs.google.com/document/d/{id}/export?format=docx` |
| Google Slides | `docs.google.com/presentation/d/*` | `https://docs.google.com/presentation/d/{id}/export?format=pptx` |

**Note:** Office 365, Dropbox Paper, and other services require OAuth or complex authentication — deferred to V1.5.

---

## Extension Specification

### Permissions

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

Note: V1 ships with minimal permissions (Google only). V1.5 adds host permissions for Office 365, Box, etc. V2 adds `<all_urls>` for content extraction on arbitrary pages.

### Context Menu Behavior (V1)

1. On extension install, query native host for default app names for each file type
2. Create context menus with dynamic labels:
   - "Open in Microsoft Excel" (if Excel is default for .xlsx)
   - "Open in Numbers" (if Numbers is default for .xlsx)
3. Menu items only appear on matching URL patterns (documentUrlPatterns)

### Download Flow (V1)

1. Construct export URL based on document type and ID
2. Call `chrome.downloads.download()` with generated filename
3. Listen for download completion via `chrome.downloads.onChanged`
4. On completion, query `chrome.downloads.search()` for file path
5. Send file path to native host via `chrome.runtime.sendNativeMessage()`

### Content Extraction Flow (V2)

1. User clicks extension icon → popup opens
2. Content script injected to scan page:
   - Find all `<table>` elements
   - Extract table metadata (name, row count)
3. Popup displays discovered content
4. User clicks an option:
   - **Tables:** Content script extracts table data → converts to XLSX → downloads → native host opens
   - **Text:** Extract `innerText` → save as .txt/.docx → native host opens
   - **PDF:** Clone DOM → remove ads → trigger print to PDF

---

## Native Host Specification

### Implementation

The native host is written in **Go** for cross-platform compatibility. Go compiles to a single static binary with no runtime dependencies, making distribution simple across macOS, Windows, and Linux.

**Platform abstraction:** The host uses a platform interface with OS-specific implementations:

| Task | macOS | Windows | Linux |
|------|-------|---------|-------|
| Get default app | `LSCopyDefaultRoleHandlerForContentType` via CGo | Registry query (`assoc`/`ftype`) | `xdg-mime query default` |
| Open file with app | `open` command | `ShellExecute` | `xdg-open` |
| Temp directory | `os.TempDir()` (NSTemporaryDirectory) | `os.TempDir()` (%TEMP%) | `os.TempDir()` (/tmp) |
| No default app handling | Reveal in Finder, prompt user | `OpenAs_RunDLL` dialog | `xdg-open` fallback |

### Host Manifest

Filename: `com.reclaim.openwith.json`

Installed to:

**macOS:**
- Chrome: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Brave: `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
- Edge: `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/`
- Chromium: `~/Library/Application Support/Chromium/NativeMessagingHosts/`

**Windows (future):**
- Chrome: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.reclaim.openwith`
- Brave: `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.reclaim.openwith`
- Edge: `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.reclaim.openwith`

**Linux (future):**
- Chrome: `~/.config/google-chrome/NativeMessagingHosts/`
- Brave: `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
- Chromium: `~/.config/chromium/NativeMessagingHosts/`

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

#### Request: Get Default Apps

```json
{
  "action": "getDefaults"
}
```

#### Response: Default Apps

```json
{
  "success": true,
  "defaults": {
    "xlsx": { "name": "Microsoft Excel", "bundleId": "com.microsoft.Excel" },
    "docx": { "name": "Microsoft Word", "bundleId": "com.microsoft.Word" },
    "pptx": { "name": "Microsoft PowerPoint", "bundleId": "com.microsoft.Powerpoint" },
    "txt": { "name": "TextEdit", "bundleId": "com.apple.TextEdit" },
    "pdf": { "name": "Preview", "bundleId": "com.apple.Preview" }
  }
}
```

#### Request: Open File

```json
{
  "action": "open",
  "filePath": "/Users/shumway/Downloads/spreadsheet.xlsx",
  "fileType": "xlsx"
}
```

#### Response: Open Result

```json
{
  "success": true,
  "tempPath": "/var/folders/xx/.../spreadsheet.xlsx"
}
```

Or on error:

```json
{
  "success": false,
  "error": "no_default_app",
  "fileType": "xlsx"
}
```

### Native Host Operations

#### getDefaults

1. Query system for default app for each supported file type:
   - `.xlsx` → spreadsheet app
   - `.docx` → word processor
   - `.pptx` → presentation app
   - `.txt` → text editor
   - `.pdf` → PDF viewer
2. Resolve to application name
3. Return mapping

#### open

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

### User Installation Steps

1. Install the extension (Chrome Web Store or sideload)
2. Run the installer package (.pkg) which:
   - Installs native host binary to `/usr/local/bin/reclaim-openwith`
   - Installs host manifests to all supported browser locations
   - Sets correct permissions

### Installer Package Contents

```
/usr/local/bin/
  └── reclaim-openwith                 # Native messaging host binary

~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
  └── com.reclaim.openwith.json   # Host manifest

~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/
  └── com.reclaim.openwith.json   # Host manifest

~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/
  └── com.reclaim.openwith.json   # Host manifest

~/Library/Application Support/Chromium/NativeMessagingHosts/
  └── com.reclaim.openwith.json   # Host manifest
```

---

## Security Considerations

- Native host only accepts messages from the specific extension ID
- File operations restricted to moving from Downloads to temp
- Quarantine attribute preserved for Gatekeeper protection
- No network access in native host
- No arbitrary command execution
- Content extraction runs in page context (same-origin policy applies)

---

## Future Considerations (Out of Scope for V1/V2)

- **App picker**: Show all compatible apps instead of just system default
- **User-defined site rules**: Let power users add custom export configurations
- **API interception**: Capture XHR/fetch responses for raw data extraction
- **Chart data extraction**: Parse Chart.js, D3, Highcharts data structures
- **Bidirectional sync**: Save changes back to cloud service
- **Keyboard shortcut**: Open current document without right-click
- **Auto-cleanup**: Option to delete temp files after app closes

---

## Success Metrics

### V1
- Context menu appears reliably on Google Docs, Sheets, and Slides
- File opens in correct default application within 3 seconds of click
- Application prompts "Save As" on first save (not overwrite to temp)
- Works across Chrome, Brave, Edge, and other Chromium browsers

### V1.5
- OAuth flow completes successfully for supported services
- Token refresh works transparently (no re-auth needed for weeks)
- At least 2 additional services supported (Office 365, Box, or Confluence)

### V2
- Tables detected on >90% of pages containing `<table>` elements
- Clean PDF removes ads on popular sites (news, blogs, documentation)
- Modal opens in <200ms after click
- View-only Google Docs successfully extracted via DOM parsing

---

## Resolved Questions

### 1. How to handle very large files that take a long time to download?

**Decision:** Set a 60-second timeout with visual feedback. No hard size limit — Google's export API already imposes its own limits (~10MB for Sheets). If download times out, show an error suggesting manual download via File → Download.

### 2. Should we show a notification/progress indicator during download?

**Decision:** Yes, minimal feedback:
- Badge on extension icon during download (e.g., "..." or spinner)
- Desktop notification only on errors
- Success case needs no notification — the app opening is its own feedback

### 3. What happens if no default app is set for a file type?

**Decision:** Platform-specific handling:
- **macOS:** Show notification explaining how to set a default app (right-click file in Finder → Get Info → Open With → Change All). Offer to reveal the downloaded file in Finder.
- **Windows (future):** Call `OpenAs_RunDLL` to show the native "How do you want to open this file?" dialog.
- **Linux (future):** Fall back to `xdg-open` which typically shows a chooser if no default is set.

### 4. Hardcoded sites vs dynamic detection?

**Decision:** Hardcoded site registry for V1 (reliable, predictable). V1.5 adds OAuth-based services. V2 adds content discovery for any page via the modal.

### 7. What about view-only documents with downloads disabled?

**Decision:** V1 attempts the export URL and shows a user-friendly error if blocked (403). V2 adds DOM-based extraction as a fallback — if the content is rendered in the browser, we can extract it. This aligns with the extension's philosophy: the browser is the user's tool.

### 5. Ad removal approach for clean PDF?

**Decision:** DOM cleanup approach. Clone the page DOM, remove elements matching ad selectors (including EasyList patterns), then print. ~50-100ms overhead, imperceptible to user. More thorough than CSS hiding since removed elements can't affect layout.

### 6. Multiple tables on a page?

**Decision:** All tables are extracted as separate sheets in a single .xlsx workbook. Tables are named by caption, nearby heading, aria-label, or fallback to "Table 1", "Table 2", etc. Always output .xlsx format — it opens in both Excel and Numbers.

# Reclaim: Open With — V2 PRD

**Scope:** Wild west content extraction from any page

**Prerequisite:** V1 complete (core flow working)

---

## Overview

V2 adds a content discovery modal that lets users extract tables, text, and clean PDFs from any webpage. It also adds view-only bypass for Google Docs when the owner has disabled downloads.

**Philosophy:** If it's rendered in the browser, it's extractable. The browser is the user's tool.

## Goals

- Discovery modal showing extractable content on any page
- Table extraction to .xlsx (multi-sheet for multiple tables)
- Clean PDF export with ads/navigation removed
- Text extraction to .txt or .docx
- View-only bypass for Google Docs with downloads disabled
- Modal opens in <200ms

## Non-Goals

- Fighting heavily obfuscated content (best effort only)
- Bidirectional sync back to cloud services
- Chart data extraction (future consideration)
- API interception for XHR/fetch responses

---

## User Experience

### Discovery Modal

**Trigger:** User clicks extension icon in toolbar (on any page)

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
│  ℹ️ Tip: On Google Docs, right-click for    │
│     one-click export.                       │
│                                             │
└─────────────────────────────────────────────┘
```

### Flow

1. User clicks extension icon on any webpage
2. Content script injected to scan page
3. Modal opens showing discovered content
4. User clicks an extraction option
5. Content extracted, converted, downloaded
6. Native host opens file in default app

---

## Extraction Capabilities

### Tables

**Detection:** All `<table>` elements in DOM

**Naming Priority:**
1. `<caption>` element
2. Nearby `<h1-6>` heading (within 2 siblings)
3. `aria-label` attribute
4. `id` attribute
5. Fallback: "Table 1", "Table 2", etc.

**Output:**
- Single table → single-sheet .xlsx
- Multiple tables → multi-sheet .xlsx (one sheet per table)
- Always .xlsx format (works in Excel and Numbers)

**Implementation:**
```javascript
function extractTables() {
  const tables = document.querySelectorAll('table');
  return Array.from(tables).map((table, i) => ({
    name: getTableName(table, i),
    rows: Array.from(table.rows).map(row =>
      Array.from(row.cells).map(cell => cell.innerText.trim())
    ),
    rowCount: table.rows.length
  }));
}
```

### Page Text

**Detection:** `document.body.innerText`

**Output Options:**
- `.txt` — plain text, opens in default text editor
- `.docx` — formatted document, opens in Word/Pages

**Implementation:**
```javascript
function extractText() {
  // Clone body, remove scripts/styles/hidden elements
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script, style, [hidden], [aria-hidden="true"]').forEach(el => el.remove());
  return clone.innerText;
}
```

### Clean PDF

**Approach:** Clone DOM, remove ads/navigation, print to PDF

**Ad Removal Selectors:**
```javascript
const adSelectors = [
  // Class-based
  '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
  '[class*="sponsor"]', '[class*="promo"]',

  // ID-based
  '[id*="ad-"]', '[id*="ads-"]', '[id*="advert"]',

  // Data attributes
  '[data-ad]', '[data-ads]', '[data-ad-unit]',

  // Common ad elements
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="amazon-adsystem"]',

  // Semantic
  '.sponsored', '.advertisement', '.ad-container',
  'aside.promotions', '.newsletter-signup',

  // Navigation (optional, user toggle)
  'header', 'footer', 'nav', 'aside',
  '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
];
```

**Implementation:**
```javascript
function cleanAndPrint() {
  const clone = document.documentElement.cloneNode(true);

  // Remove ads
  clone.querySelectorAll(adSelectors.join(',')).forEach(el => el.remove());

  // Open in new window and print
  const printWindow = window.open('', '_blank');
  printWindow.document.write(clone.outerHTML);
  printWindow.document.close();
  printWindow.print();
}
```

---

## View-Only Bypass

When a Google Doc/Sheet/Slide has downloads disabled (403 on export URL), V2 extracts content directly from the rendered DOM.

### Google Docs

**Detection:** `docs.google.com/document/d/*` + 403 on export

**Extraction:**
```javascript
// Google Docs renders text in .kix-lineview elements
function extractGoogleDoc() {
  const lines = document.querySelectorAll('.kix-lineview');
  return Array.from(lines).map(line => line.innerText).join('\n');
}
```

**Output:** .txt or .docx

### Google Sheets

**Detection:** `docs.google.com/spreadsheets/d/*` + 403 on export

**Extraction:**
```javascript
// Google Sheets renders cells in a grid structure
function extractGoogleSheet() {
  const cells = document.querySelectorAll('[data-cell]');
  // Build 2D array from cell positions
  // Handle merged cells, formulas display as values
}
```

**Output:** .xlsx

**Limitations:**
- Only visible cells extracted (user must scroll to load all data)
- Large sheets may require pagination

### Google Slides

**Detection:** `docs.google.com/presentation/d/*` + 403 on export

**Extraction Options:**
1. **Text extraction:** Pull text from slide elements
2. **Screenshot:** Capture each slide as image using canvas

**Output:** .txt (text) or .pdf (screenshots)

---

## Extension Changes

### New Permissions

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
    "<all_urls>"
  ]
}
```

Note: `<all_urls>` required for content extraction on arbitrary pages.

### Popup UI

The popup becomes the discovery modal. Implemented as:
- HTML/CSS/JS popup
- Communicates with content script via `chrome.tabs.sendMessage`
- Content script returns discovered content metadata
- User clicks → content script extracts → background script downloads → native host opens

### Content Script

Injected on popup open to scan page:

```typescript
interface PageContent {
  tables: TableInfo[];
  hasText: boolean;
  textPreview: string;  // First 200 chars
  isGoogleDoc: boolean;
  isViewOnly: boolean;  // 403 on export
}

interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  preview: string[][];  // First 3 rows
}
```

---

## File Generation

### XLSX Generation

Use SheetJS (xlsx) library bundled with extension:

```javascript
import XLSX from 'xlsx';

function createWorkbook(tables) {
  const wb = XLSX.utils.book_new();
  tables.forEach((table, i) => {
    const ws = XLSX.utils.aoa_to_sheet(table.rows);
    XLSX.utils.book_append_sheet(wb, ws, table.name.slice(0, 31)); // Sheet name max 31 chars
  });
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
```

### DOCX Generation

Use docx library or simple HTML-to-DOCX conversion:

```javascript
// Option 1: Use docx library
import { Document, Packer, Paragraph } from 'docx';

// Option 2: HTML-based (Word opens HTML with .docx extension)
function createDocx(text) {
  const html = `<html><body><pre>${escapeHtml(text)}</pre></body></html>`;
  return new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
```

---

## Native Host Changes

### New File Types

Add support for `.txt` file type:

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

---

## Performance

**Target:** Modal opens in <200ms

**Optimizations:**
- Lazy table scanning (scan on modal open, not on page load)
- Limit initial scan to first 50 tables
- Show "Scanning..." state while content script works
- Cache scan results for page (invalidate on navigation)

---

## Security Considerations

- Content scripts run in page context (same-origin policy applies)
- No cross-origin data access
- User must explicitly click to extract (no automatic extraction)
- Extracted content never sent to any server
- All processing happens locally

---

## Success Metrics

- Tables detected on >90% of pages containing `<table>` elements
- Clean PDF removes ads on popular sites (news, blogs, documentation)
- Modal opens in <200ms after click
- View-only Google Docs successfully extracted via DOM parsing

---

## Future Considerations (Out of Scope)

- **Chart data extraction:** Parse Chart.js, D3, Highcharts data structures
- **API interception:** Capture XHR/fetch responses for raw data
- **Canvas extraction:** Extract data from canvas-rendered content
- **Shadow DOM:** Pierce shadow roots for web component content

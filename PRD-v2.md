# Reclaim: Open With — V2 PRD

**Scope:** Wild west content extraction from any webpage

**Prerequisite:** V1 complete

---

## Problem Statement

Users encounter valuable content trapped in web pages with no export option: data tables without download buttons, articles cluttered with ads when printing, and view-only documents where the owner disabled downloads. The content is rendered in the browser — the user should be able to extract it.

## Target Users

- **Data analysts** who need to pull tables from reports, government sites, or dashboards
- **Researchers** who want clean PDFs of articles without ad clutter
- **Professionals** blocked by view-only restrictions on Google Docs they can see but can't download

## Success Metrics

- Tables detected on >90% of pages containing `<table>` elements
- Clean PDF removes ads on top 20 news/blog sites
- Modal opens in <200ms after click
- View-only Google Docs extracted successfully via DOM parsing
- Zero data sent to external servers (all processing local)

---

## Functional Decomposition

### Capability: Content Discovery

Scans pages to find extractable content.

#### Feature: Table Detection
- **Description**: Find all table elements in the page DOM
- **Inputs**: Document DOM
- **Outputs**: Array of TableInfo (name, row count, column count, preview)
- **Behavior**: Query `table` elements, extract metadata, filter noise (1-row tables, layout tables)

#### Feature: Table Naming
- **Description**: Generate meaningful names for discovered tables
- **Inputs**: Table element, surrounding DOM context
- **Outputs**: Human-readable table name
- **Behavior**: Priority: caption > aria-label > nearby heading > id > "Table N"

#### Feature: Text Content Analysis
- **Description**: Determine if page has meaningful extractable text
- **Inputs**: Document body
- **Outputs**: Boolean (has content) + preview text
- **Behavior**: Extract innerText, filter scripts/styles, check length threshold

#### Feature: Google Docs Detection
- **Description**: Identify if page is a Google Doc/Sheet/Slide with view-only restrictions
- **Inputs**: Tab URL, page DOM
- **Outputs**: Document type, view-only status
- **Behavior**: Check URL pattern, detect disabled download option

### Capability: Table Extraction

Extracts table data and converts to spreadsheet format.

#### Feature: Cell Extraction
- **Description**: Extract text content from each table cell
- **Inputs**: Table element
- **Outputs**: 2D array of strings (rows × columns)
- **Behavior**: Iterate rows/cells, extract innerText, handle colspan/rowspan

#### Feature: Header Detection
- **Description**: Identify header row for column labels
- **Inputs**: Extracted table data
- **Outputs**: Boolean (has header) + header row index
- **Behavior**: Check for `<thead>`, `<th>` elements, or first-row heuristics

#### Feature: XLSX Generation
- **Description**: Convert extracted table(s) to Excel workbook
- **Inputs**: Array of extracted tables
- **Outputs**: XLSX blob
- **Behavior**: Use SheetJS library, one sheet per table, apply headers

#### Feature: Multi-Table Handling
- **Description**: Combine multiple tables into single workbook
- **Inputs**: Array of TableInfo
- **Outputs**: Single XLSX with multiple sheets
- **Behavior**: Name sheets by table name, truncate to 31 chars, dedupe names

### Capability: Text Extraction

Extracts clean text from page content.

#### Feature: Content Isolation
- **Description**: Extract main content, excluding boilerplate
- **Inputs**: Document DOM
- **Outputs**: Clean text string
- **Behavior**: Clone DOM, remove scripts/styles/hidden elements, extract innerText

#### Feature: TXT Generation
- **Description**: Save extracted text as plain text file
- **Inputs**: Clean text
- **Outputs**: TXT blob
- **Behavior**: Simple text file with UTF-8 encoding

#### Feature: DOCX Generation
- **Description**: Convert extracted text to Word document
- **Inputs**: Clean text
- **Outputs**: DOCX blob
- **Behavior**: Use docx library or HTML-to-DOCX approach

### Capability: Clean PDF Generation

Creates ad-free PDF of page content.

#### Feature: DOM Cloning
- **Description**: Create isolated copy of page DOM for cleaning
- **Inputs**: Document DOM
- **Outputs**: Cloned DOM fragment
- **Behavior**: Deep clone document, maintain styles

#### Feature: Ad Removal
- **Description**: Remove advertising elements from cloned DOM
- **Inputs**: Cloned DOM
- **Outputs**: Cleaned DOM
- **Behavior**: Query and remove elements matching ad selectors, EasyList patterns

#### Feature: Navigation Removal
- **Description**: Optionally remove headers, footers, sidebars
- **Inputs**: Cloned DOM, user preferences
- **Outputs**: Simplified DOM
- **Behavior**: Remove header/footer/nav/aside elements based on user toggle

#### Feature: Print to PDF
- **Description**: Render cleaned DOM to PDF via browser print
- **Inputs**: Cleaned DOM
- **Outputs**: PDF (via system print dialog)
- **Behavior**: Open cleaned content in new window, trigger print

### Capability: View-Only Bypass

Extracts content from Google Docs with downloads disabled.

#### Feature: Google Docs Text Extraction
- **Description**: Extract text from rendered Google Docs editor
- **Inputs**: Google Docs page DOM
- **Outputs**: Extracted text
- **Behavior**: Query `.kix-lineview` elements, concatenate text content

#### Feature: Google Sheets Grid Extraction
- **Description**: Extract cell data from rendered Google Sheets grid
- **Inputs**: Google Sheets page DOM
- **Outputs**: 2D array of cell values
- **Behavior**: Parse grid structure, handle visible cells only

#### Feature: Google Slides Content Extraction
- **Description**: Extract text or screenshots from Google Slides
- **Inputs**: Google Slides page DOM
- **Outputs**: Text content or image blobs
- **Behavior**: Extract slide text elements, optionally capture via canvas

### Capability: Discovery Modal UI

User interface for selecting content to extract.

#### Feature: Modal Rendering
- **Description**: Display discovered content in popup UI
- **Inputs**: Discovered content (tables, text, PDF options)
- **Outputs**: Rendered modal
- **Behavior**: Show categorized list, table previews, action buttons

#### Feature: Content Selection
- **Description**: Handle user selecting extraction option
- **Inputs**: User click on extraction button
- **Outputs**: Trigger extraction flow
- **Behavior**: Dispatch message to content script, show progress

#### Feature: Progress Indication
- **Description**: Show extraction progress in modal
- **Inputs**: Extraction status updates
- **Outputs**: Updated UI state
- **Behavior**: Display spinner, status text, handle completion/error

#### Feature: View-Only Mode UI
- **Description**: Special UI for view-only Google Docs
- **Inputs**: View-only document detection
- **Outputs**: Bypass extraction options
- **Behavior**: Show "Extract via DOM" option, explain limitations

---

## Structural Decomposition

```
extension/
├── src/
│   ├── background/
│   │   ├── index.ts              # Extended with modal coordination
│   │   └── ... (V1/V1.5 modules)
│   ├── content/                  # NEW: Content scripts
│   │   ├── discovery.ts          # Page scanning
│   │   ├── tables.ts             # Table extraction
│   │   ├── text.ts               # Text extraction
│   │   ├── pdf.ts                # Clean PDF generation
│   │   ├── bypass/               # View-only bypass
│   │   │   ├── google-docs.ts
│   │   │   ├── google-sheets.ts
│   │   │   └── google-slides.ts
│   │   └── index.ts              # Content script entry
│   ├── popup/
│   │   ├── modal.html            # NEW: Discovery modal
│   │   ├── modal.ts              # Modal logic
│   │   ├── modal.css
│   │   └── settings/ (V1.5)
│   ├── lib/                      # NEW: File generation libraries
│   │   ├── xlsx-generator.ts     # SheetJS wrapper
│   │   └── docx-generator.ts     # DOCX generation
│   └── types/
│       └── messages.ts           # Extended with content messages
├── manifest.json                 # Updated with content scripts, <all_urls>
└── package.json                  # SheetJS, docx dependencies
```

### Module: content/discovery
- **Maps to capability**: Content Discovery
- **Responsibility**: Scan page for extractable content
- **Exports**:
  - `discoverContent(): Promise<PageContent>`
  - `isViewOnlyGoogleDoc(): boolean`

### Module: content/tables
- **Maps to capability**: Table Extraction
- **Responsibility**: Extract and process tables
- **Exports**:
  - `extractTable(element: HTMLTableElement): TableData`
  - `extractAllTables(): TableData[]`

### Module: content/text
- **Maps to capability**: Text Extraction
- **Responsibility**: Extract clean text from page
- **Exports**:
  - `extractText(): string`
  - `getTextPreview(length: number): string`

### Module: content/pdf
- **Maps to capability**: Clean PDF Generation
- **Responsibility**: Generate ad-free printable version
- **Exports**:
  - `generateCleanPdf(options: CleanOptions): void`

### Module: content/bypass/*
- **Maps to capability**: View-Only Bypass
- **Responsibility**: Extract content from restricted Google Docs
- **Exports**:
  - `extractGoogleDocText(): string`
  - `extractGoogleSheetData(): TableData`
  - `extractGoogleSlideContent(): SlideContent[]`

### Module: popup/modal
- **Maps to capability**: Discovery Modal UI
- **Responsibility**: Render and manage discovery modal
- **Exports**:
  - Event handlers for extraction buttons
  - UI state management

### Module: lib/xlsx-generator
- **Maps to capability**: Table Extraction (XLSX)
- **Responsibility**: Wrap SheetJS for workbook generation
- **Exports**:
  - `createWorkbook(tables: TableData[]): Blob`

### Module: lib/docx-generator
- **Maps to capability**: Text Extraction (DOCX)
- **Responsibility**: Generate Word documents from text
- **Exports**:
  - `createDocument(text: string): Blob`

---

## Dependency Graph

### Foundation Layer (Phase 0)
New modules with no internal dependencies.

- **content/discovery**: Page scanning primitives
- **content/text**: Text extraction primitives
- **lib/xlsx-generator**: SheetJS wrapper
- **lib/docx-generator**: DOCX generation

### Extraction Layer (Phase 1)
- **content/tables**: Depends on [lib/xlsx-generator]
- **content/pdf**: Depends on [content/text] (for content detection)
- **content/bypass/google-docs**: Depends on [content/text]
- **content/bypass/google-sheets**: Depends on [content/tables]
- **content/bypass/google-slides**: Depends on [content/text, lib/xlsx-generator]

### UI Layer (Phase 2)
- **popup/modal**: Depends on [content/discovery]
- **content/index**: Depends on [all content modules]

### Integration Layer (Phase 3)
- **background/index (extended)**: Depends on [popup/modal, content/index, V1 modules]
- **manifest.json**: Depends on [all modules, requires `<all_urls>`]

---

## Implementation Roadmap

### Phase 0: Content Primitives
**Goal**: Basic extraction functions without UI

**Entry Criteria**: V1 complete

**Tasks**:
- [ ] Implement table detection and extraction (depends on: none)
  - Acceptance: Extracts tables from test pages
  - Test: Unit tests with sample HTML

- [ ] Implement text extraction (depends on: none)
  - Acceptance: Extracts clean text, filters noise
  - Test: Unit tests with various page structures

- [ ] Integrate SheetJS for XLSX generation (depends on: none)
  - Acceptance: Creates valid XLSX from table data
  - Test: Open generated file in Excel

- [ ] Implement DOCX generation (depends on: none)
  - Acceptance: Creates valid DOCX from text
  - Test: Open generated file in Word

**Exit Criteria**: All extraction functions work standalone

**Delivers**: Building blocks for modal

---

### Phase 1: Extraction Modules
**Goal**: Complete extraction capabilities

**Entry Criteria**: Phase 0 complete

**Tasks**:
- [ ] Implement multi-table XLSX workbook (depends on: [xlsx-generator, tables])
  - Acceptance: Multiple tables → multiple sheets
  - Test: Extract from page with 3+ tables

- [ ] Implement clean PDF generation (depends on: [text])
  - Acceptance: Removes ads from test page
  - Test: Manual verification on news site

- [ ] Implement Google Docs bypass (depends on: [text])
  - Acceptance: Extracts text from view-only doc
  - Test: Manual test with restricted document

- [ ] Implement Google Sheets bypass (depends on: [tables])
  - Acceptance: Extracts visible grid data
  - Test: Manual test with restricted sheet

**Exit Criteria**: All extraction paths working

**Delivers**: Full extraction capability (no UI yet)

---

### Phase 2: Discovery Modal
**Goal**: User interface for content extraction

**Entry Criteria**: Phase 1 complete

**Tasks**:
- [ ] Implement content discovery scanning (depends on: [all extractors])
  - Acceptance: Detects tables, text, PDF options
  - Test: Unit tests with mock DOM

- [ ] Build modal HTML/CSS (depends on: none)
  - Acceptance: Matches design spec
  - Test: Visual verification

- [ ] Implement modal logic (depends on: [discovery, modal UI])
  - Acceptance: Shows discovered content, handles clicks
  - Test: Integration test in browser

- [ ] Implement view-only mode UI (depends on: [bypass modules])
  - Acceptance: Shows bypass options on restricted docs
  - Test: Manual verification

**Exit Criteria**: Modal opens and triggers extractions

**Delivers**: Usable V2 feature

---

### Phase 3: Polish & Edge Cases
**Goal**: Production-ready extraction

**Entry Criteria**: Phase 2 complete

**Tasks**:
- [ ] Improve ad removal selectors (depends on: [pdf])
  - Acceptance: Works on top 20 news sites
  - Test: Manual testing matrix

- [ ] Handle large tables (depends on: [tables])
  - Acceptance: Tables with 1000+ rows don't crash
  - Test: Performance benchmarks

- [ ] Handle complex table structures (depends on: [tables])
  - Acceptance: colspan/rowspan handled correctly
  - Test: Unit tests with complex tables

- [ ] Update manifest for `<all_urls>` (depends on: [all modules])
  - Acceptance: Permission prompt clear
  - Test: Fresh install verification

**Exit Criteria**: Robust extraction across varied sites

**Delivers**: V2 release candidate

---

## Test Strategy

### Test Pyramid

```
        /\
       /E2E\       ← 10% (Full modal flow on real sites)
      /------\
     /Integration\ ← 25% (Content script + popup coordination)
    /------------\
   /  Unit Tests  \ ← 65% (Table parsing, text extraction, file generation)
  /----------------\
```

### Coverage Requirements
- Line coverage: 80% minimum
- Table extraction: 100% branch coverage (critical path)
- File generation: Must produce valid files openable by target apps

### Critical Test Scenarios

#### Table Detection
**Happy path**:
- Page with 3 semantic tables
- Expected: All 3 detected with correct names

**Edge cases**:
- Layout tables (1 row, 1 column)
- Nested tables
- Tables inside iframes (same origin)
- Expected: Layout tables filtered, nested handled, iframe tables included

**Error cases**:
- No tables on page
- Malformed HTML tables
- Expected: Empty result, no crash

#### Table Extraction
**Happy path**:
- Standard table with headers
- Expected: Correct 2D array with header row marked

**Edge cases**:
- colspan="3" in header
- rowspan="2" in data
- Mixed text/numbers/dates
- Expected: Cells expanded correctly, data preserved

**Error cases**:
- Table with only images
- Table with embedded scripts
- Expected: Empty cells, no script execution

#### Clean PDF
**Happy path**:
- News article with sidebar ads
- Expected: Ads removed, article intact

**Edge cases**:
- Page with CSS-hidden content
- Page with lazy-loaded images
- Expected: Hidden content excluded, images present if loaded

**Error cases**:
- Page blocks print
- Expected: Fall back to normal print dialog

#### View-Only Bypass
**Happy path**:
- View-only Google Doc with text
- Expected: Text extracted completely

**Edge cases**:
- Doc with images (text only extracted)
- Sheet with hidden columns
- Expected: Text extracted, hidden columns excluded

**Error cases**:
- Google changes DOM structure
- Expected: Graceful failure with message

---

## Architecture

### Content Script Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                          Web Page                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Content Script                            │  │
│  │  ┌─────────┐  ┌────────┐  ┌──────┐  ┌────────────────────┐ │  │
│  │  │Discovery│  │ Tables │  │ Text │  │ View-Only Bypass   │ │  │
│  │  │         │  │        │  │      │  │ (Google Docs only) │ │  │
│  │  └────┬────┘  └───┬────┘  └──┬───┘  └─────────┬──────────┘ │  │
│  │       │           │          │                │            │  │
│  │       └───────────┴──────────┴────────────────┘            │  │
│  │                           │                                 │  │
│  └───────────────────────────┼─────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────┘
                               │ chrome.runtime.sendMessage
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Service Worker (Background)                    │
│  ┌───────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Message Router│──│ File Generation │──│ Native Client (V1) │  │
│  └───────────────┘  │ (XLSX, DOCX)    │  └────────────────────┘  │
│                     └─────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │   Native Host    │
                    │ (open file)      │
                    └──────────────────┘
```

### Ad Removal Selector List

```javascript
const adSelectors = [
  // Class patterns
  '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
  '[class*="sponsor"]', '[class*="promo"]', '[class*="banner"]',

  // ID patterns
  '[id*="ad-"]', '[id*="ads-"]', '[id*="advert"]',

  // Data attributes
  '[data-ad]', '[data-ads]', '[data-ad-unit]', '[data-testid*="ad"]',

  // Common ad containers
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="amazon-adsystem"]',
  'iframe[src*="facebook.com/plugins"]',

  // Semantic
  '.sponsored', '.advertisement', '.ad-container', '.ad-wrapper',
  'aside.promotions', '.newsletter-signup', '.social-share',

  // Navigation (optional)
  'header', 'footer', 'nav', 'aside',
  '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
];
```

### Technology Decisions

**Decision: SheetJS (xlsx) for spreadsheet generation**
- **Rationale**: Battle-tested, works in browser, produces real XLSX
- **Trade-offs**: Adds ~300KB to extension bundle
- **Alternatives**: csv-only (too limited), server-side (defeats local-only goal)

**Decision: DOM cloning for clean PDF (not screenshot)**
- **Rationale**: Maintains text selectability, respects print styles
- **Trade-offs**: Some dynamic content may not clone correctly
- **Alternatives**: html2canvas (rasterizes text), Puppeteer (requires Node)

**Decision: `<all_urls>` permission**
- **Rationale**: Required for content extraction on any page
- **Trade-offs**: Broader permission prompt may concern users
- **Alternatives**: On-demand permission (too much friction)

---

## Risks

### Technical Risks

**Risk**: Google changes DOM structure for Docs/Sheets/Slides
- **Impact**: High (breaks bypass)
- **Likelihood**: Medium (happens occasionally)
- **Mitigation**: Abstract selectors, version detection
- **Fallback**: Detect failure, show "structure changed" message

**Risk**: Ad selectors block legitimate content
- **Impact**: Medium (false positives in PDF)
- **Likelihood**: Medium (site-dependent)
- **Mitigation**: Conservative selectors, user toggle for nav removal
- **Fallback**: Show both clean and original options

**Risk**: Large tables cause memory issues
- **Impact**: Medium (browser hang)
- **Likelihood**: Low (unusual case)
- **Mitigation**: Streaming extraction, row limit option
- **Fallback**: Show warning for tables >10K rows

### Dependency Risks

**Risk**: SheetJS license changes
- **Impact**: Medium (must find alternative)
- **Likelihood**: Low (stable project)
- **Mitigation**: Abstract behind wrapper module
- **Fallback**: csv-only fallback mode

### Scope Risks

**Risk**: Users want more bypass targets (Notion, Coda, etc.)
- **Impact**: Low (scope creep)
- **Likelihood**: High
- **Mitigation**: Document bypass architecture for easy additions
- **Fallback**: Community contributions via abstraction

---

## Appendix

### View-Only Bypass: Ethical Considerations

This feature extracts content that is rendered in the user's browser but marked as "view-only" by the document owner. Our position:

1. **If content is rendered, it's already on the user's machine** — we're not bypassing server-side protection
2. **Users have legitimate needs** — accessibility tools, offline access, archival
3. **We don't circumvent authentication** — user must already have view access
4. **Owner intent vs. user rights** — the browser is the user's tool

This aligns with the extension's philosophy: "Reclaim" user control over content in their browser.

### Ad Selector Sources

- EasyList community patterns
- uBlock Origin filter lists
- Manual testing on popular sites

### Glossary

- **Content Script**: JavaScript that runs in the context of web pages
- **DOM Cloning**: Creating a copy of the page structure for modification
- **View-Only**: Google Docs permission level that allows viewing but not downloading

### Open Questions

- Should we support partial table selection? (Select rows/columns to extract)
- Should clean PDF have a "reader mode" option? (Simplify styling further)
- How to handle infinite scroll tables? (Only extract visible, or scroll and capture?)

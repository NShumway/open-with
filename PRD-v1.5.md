# Reclaim: Open With — V1.5 PRD

**Scope:** Additional cloud storage services (OneDrive, Dropbox, Box)

**Prerequisite:** V1 complete

---

## Problem Statement

V1 only supports Google Workspace. Users of OneDrive, Dropbox, and Box must still manually download and open files. The previous approach assumed OAuth was required — but these services already authenticate users via browser sessions. The real challenge is detecting supported pages and discovering download URLs for each service.

## Target Users

- **OneDrive/SharePoint users** who want the same one-click experience as Google Docs
- **Dropbox users** sharing files who want quick local access
- **Box users** in enterprise environments

## Success Metrics

- Context menu appears on supported cloud storage file pages
- Same <3 second file open time as V1
- Zero additional authentication required (uses existing browser session)
- At least 2 additional services fully supported

---

## Key Insight: No OAuth Required

When a user clicks "Download" on OneDrive, the browser:
1. Makes a request to a download endpoint
2. Sends session cookies automatically
3. Receives the file

Our extension runs inside the browser with access to the same cookies. We can make the same authenticated requests — no OAuth flow needed.

**The challenge is per-service:** discovering how each service constructs or exposes download URLs.

---

## Functional Decomposition

### Capability: Service Detection

Extends V1's site-registry for new cloud services.

#### Feature: OneDrive/SharePoint Detection
- **Description**: Identify OneDrive and SharePoint document URLs
- **Inputs**: Tab URL
- **Outputs**: Boolean match, file metadata
- **Behavior**: Match patterns like:
  - `onedrive.live.com/edit.aspx?...`
  - `*.sharepoint.com/:w:/...` (Word)
  - `*.sharepoint.com/:x:/...` (Excel)
  - `*.sharepoint.com/:p:/...` (PowerPoint)
  - `*.sharepoint.com/.../_layouts/15/Doc.aspx?...`

#### Feature: Dropbox Detection
- **Description**: Identify Dropbox file preview URLs
- **Inputs**: Tab URL
- **Outputs**: Boolean match, file metadata
- **Behavior**: Match patterns like:
  - `www.dropbox.com/s/{id}/{filename}`
  - `www.dropbox.com/scl/fi/{id}/...`
  - `www.dropbox.com/home/...` (file viewer)

#### Feature: Box Detection
- **Description**: Identify Box file preview URLs
- **Inputs**: Tab URL
- **Outputs**: Boolean match, file ID
- **Behavior**: Match patterns like:
  - `app.box.com/file/{id}`
  - `app.box.com/s/{shared_id}`
  - `*.app.box.com/file/{id}` (enterprise)

### Capability: Download URL Discovery

Each service requires a different strategy to obtain the actual download URL.

#### Feature: OneDrive Download URL
- **Description**: Obtain download URL for OneDrive/SharePoint files
- **Strategy**: DOM scraping + URL construction
- **Approach**:
  1. Look for download button's `href` or `data-*` attributes
  2. Or construct from URL pattern: replace `/edit.aspx` with `/download.aspx`
  3. Or intercept the download action's API call
- **Fallback**: Content script clicks the actual download button

#### Feature: Dropbox Download URL
- **Description**: Obtain download URL for Dropbox files
- **Strategy**: URL parameter manipulation
- **Approach**:
  1. Shared links: append `?dl=1` to force download
  2. File viewer: extract file ID, construct `/sharing/fetch_download_link` API call
  3. Or scrape the "Download" button's target URL from page
- **Fallback**: Intercept `webRequest` when download is triggered

#### Feature: Box Download URL
- **Description**: Obtain download URL for Box files
- **Strategy**: API call with session cookies
- **Approach**:
  1. Extract file ID from URL
  2. Call Box's internal download endpoint (same one the UI uses)
  3. Or scrape download URL from page's embedded data
- **Fallback**: Content script triggers native download button

### Capability: Download Strategies

Different approaches for obtaining files, ordered by preference.

#### Feature: Direct URL Download
- **Description**: Download via constructed/discovered URL
- **Inputs**: Download URL
- **Outputs**: Downloaded file path
- **Behavior**: Use `chrome.downloads.download()` with discovered URL; cookies sent automatically
- **When to use**: URL is predictable or easily scraped

#### Feature: Fetch + Blob Download
- **Description**: Fetch file content via fetch(), save as blob
- **Inputs**: API endpoint URL
- **Outputs**: Downloaded file path
- **Behavior**: `fetch()` with `credentials: 'include'`, convert to blob, trigger download
- **When to use**: Need to call internal API that returns file content

#### Feature: WebRequest Interception
- **Description**: Intercept download URL when user triggers native download
- **Inputs**: User clicks our context menu
- **Outputs**: Captured download URL
- **Behavior**:
  1. Register `webRequest.onBeforeRequest` listener
  2. Programmatically trigger site's download button via content script
  3. Capture the resulting download URL
  4. Cancel the original download, re-trigger with our flow
- **When to use**: Can't reverse-engineer download URL pattern

#### Feature: Content Script Download Trigger
- **Description**: Use content script to trigger native download, intercept result
- **Inputs**: Context menu click
- **Outputs**: File path after download completes
- **Behavior**: Inject script that clicks download button, monitor `chrome.downloads` for new download
- **When to use**: Last resort when other methods fail

### Capability: Extended Context Menu

Updates V1's context menu for new services.

#### Feature: Multi-Service Menu
- **Description**: Show appropriate context menu based on current site
- **Inputs**: Current URL, detected service
- **Outputs**: Context menu with correct label
- **Behavior**: "Open in Excel" on OneDrive spreadsheet, "Open in Word" on Dropbox .docx, etc.

#### Feature: File Type Detection
- **Description**: Determine file type from URL or page content
- **Inputs**: URL, page DOM (via content script)
- **Outputs**: File extension, MIME type
- **Behavior**:
  - Parse extension from URL/filename
  - Or scrape from page metadata
  - Or infer from service-specific URL patterns (SharePoint `:x:` = Excel)

---

## Structural Decomposition

```
extension/
├── src/
│   ├── background/
│   │   ├── index.ts              # Extended with new services
│   │   ├── site-registry.ts      # Extended with OneDrive/Dropbox/Box
│   │   ├── downloader.ts         # Extended with new download strategies
│   │   ├── native-client.ts      # (unchanged from V1)
│   │   ├── context-menu.ts       # (unchanged from V1)
│   │   └── services/             # NEW: Per-service logic
│   │       ├── index.ts          # Service registry
│   │       ├── google.ts         # V1 Google logic (refactored)
│   │       ├── onedrive.ts       # OneDrive/SharePoint
│   │       ├── dropbox.ts        # Dropbox
│   │       └── box.ts            # Box
│   ├── content/                  # NEW: Content scripts for DOM access
│   │   ├── scraper.ts            # Generic DOM scraping utilities
│   │   └── download-trigger.ts   # Trigger native download buttons
│   └── types/
│       └── messages.ts           # Extended with new message types
├── manifest.json                 # Updated with content script config
└── package.json
```

### Module: services/index
- **Maps to capability**: Service Detection
- **Responsibility**: Route URLs to correct service handler
- **Exports**:
  - `detectService(url: string): ServiceHandler | null`
  - `getSupportedPatterns(): string[]` (for manifest)

### Module: services/onedrive
- **Maps to capability**: OneDrive Detection + Download
- **Responsibility**: Handle OneDrive/SharePoint files
- **Exports**:
  - `detect(url: string): FileInfo | null`
  - `getDownloadUrl(info: FileInfo, tab: Tab): Promise<string>`
  - `getFileType(info: FileInfo): FileType`

### Module: services/dropbox
- **Maps to capability**: Dropbox Detection + Download
- **Responsibility**: Handle Dropbox files
- **Exports**:
  - `detect(url: string): FileInfo | null`
  - `getDownloadUrl(info: FileInfo, tab: Tab): Promise<string>`
  - `getFileType(info: FileInfo): FileType`

### Module: services/box
- **Maps to capability**: Box Detection + Download
- **Responsibility**: Handle Box files
- **Exports**:
  - `detect(url: string): FileInfo | null`
  - `getDownloadUrl(info: FileInfo, tab: Tab): Promise<string>`
  - `getFileType(info: FileInfo): FileType`

### Module: content/scraper
- **Maps to capability**: Download URL Discovery
- **Responsibility**: Extract download URLs from page DOM
- **Exports**:
  - `findDownloadLink(): string | null`
  - `getFileMetadata(): FileMetadata`
  - `clickDownloadButton(): void`

### Module: downloader (extended)
- **Maps to capability**: Download Strategies
- **Responsibility**: Execute downloads using appropriate strategy
- **Exports**:
  - `downloadFromUrl(url: string, filename: string): Promise<string>`
  - `downloadViaFetch(url: string, filename: string): Promise<string>`
  - `downloadViaInterception(tab: Tab): Promise<string>`

---

## Per-Service Research Required

Before implementation, each service needs investigation:

### OneDrive/SharePoint
- [ ] Document URL patterns for personal vs business accounts
- [ ] Test if `/download.aspx` pattern works universally
- [ ] Identify where download URL is exposed in DOM
- [ ] Check if `webRequest` can intercept download redirects

### Dropbox
- [ ] Confirm `?dl=1` works for all shared link types
- [ ] Document the `/sharing/fetch_download_link` API
- [ ] Test file viewer download button behavior
- [ ] Check enterprise/team account differences

### Box
- [ ] Document Box's internal download API endpoint
- [ ] Test shared link vs direct file access
- [ ] Identify DOM elements containing download URLs
- [ ] Check enterprise SSO account behavior

---

## Implementation Roadmap

### Phase 0: Research & Prototype
**Goal**: Validate download strategies for each service

**Entry Criteria**: V1 complete and working

**Tasks**:
- [ ] Research OneDrive URL patterns and download mechanisms
  - Acceptance: Documented patterns, working prototype
  - Test: Manual test with real OneDrive files

- [ ] Research Dropbox URL patterns and download mechanisms
  - Acceptance: Documented patterns, working prototype
  - Test: Manual test with real Dropbox files

- [ ] Research Box URL patterns and download mechanisms
  - Acceptance: Documented patterns, working prototype
  - Test: Manual test with real Box files

**Exit Criteria**: Download strategy validated for at least 2 services

**Delivers**: Technical specification for each service

---

### Phase 1: Service Framework
**Goal**: Refactor V1 code to support multiple services

**Entry Criteria**: Phase 0 complete

**Tasks**:
- [ ] Create service registry abstraction (depends on: none)
  - Acceptance: Google logic refactored into service module
  - Test: V1 functionality unchanged

- [ ] Implement content script infrastructure (depends on: none)
  - Acceptance: Can inject scripts, communicate with background
  - Test: Content script runs on target pages

- [ ] Extend downloader for multiple strategies (depends on: none)
  - Acceptance: Supports URL, fetch, and interception methods
  - Test: Unit tests for each strategy

**Exit Criteria**: Framework ready, V1 still works

**Delivers**: Extensible architecture for adding services

---

### Phase 2: First New Service
**Goal**: Complete OneDrive support (most common request)

**Entry Criteria**: Phase 1 complete

**Tasks**:
- [ ] Implement OneDrive URL detection (depends on: [service registry])
  - Acceptance: Correctly identifies OneDrive/SharePoint URLs
  - Test: Unit tests with various URL patterns

- [ ] Implement OneDrive download URL discovery (depends on: [detection, content scripts])
  - Acceptance: Retrieves working download URL
  - Test: End-to-end with real OneDrive files

- [ ] Integrate with context menu (depends on: [detection, download])
  - Acceptance: Menu appears, download works
  - Test: Full flow manual test

**Exit Criteria**: Can open OneDrive doc in desktop app

**Delivers**: First additional service working

---

### Phase 3: Additional Services
**Goal**: Add Dropbox and Box support

**Entry Criteria**: Phase 2 complete

**Tasks**:
- [ ] Implement Dropbox service (depends on: [framework])
  - Acceptance: Detection + download working
  - Test: End-to-end with real Dropbox files

- [ ] Implement Box service (depends on: [framework])
  - Acceptance: Detection + download working
  - Test: End-to-end with real Box files

**Exit Criteria**: All three new services working

**Delivers**: Full V1.5 functionality

---

## Test Strategy

### Test Pyramid

```
        /\
       /E2E\       ← 15% (Full flow per service with real accounts)
      /------\
     /Integration\ ← 35% (Download strategies, content scripts)
    /------------\
   /  Unit Tests  \ ← 50% (URL detection, pattern matching)
  /----------------\
```

### Critical Test Scenarios

#### URL Detection (per service)
**Happy path**:
- Various valid URLs for service
- Expected: Correct detection, file info extracted

**Edge cases**:
- URLs with query params, fragments
- Enterprise/custom domain URLs
- Expected: Still detects correctly

**Error cases**:
- Similar but unsupported URLs
- Expected: Returns null, no false positives

#### Download URL Discovery (per service)
**Happy path**:
- Standard file on service
- Expected: Working download URL obtained

**Edge cases**:
- Large files, special characters in name
- Expected: Download still works

**Error cases**:
- File requires additional permissions
- File deleted/moved
- Expected: Appropriate error message

---

## Architecture

### Download Flow (Extended)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Chrome Extension (MV3)                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Background Script                          │ │
│  │  ┌─────────┐   ┌─────────────┐   ┌──────────────────────────┐ │ │
│  │  │ Context │──►│   Service   │──►│    Download Strategy     │ │ │
│  │  │  Menu   │   │  Registry   │   │  ┌─────────────────────┐ │ │ │
│  │  └─────────┘   │             │   │  │ 1. Direct URL       │ │ │ │
│  │                │ ┌─────────┐ │   │  │ 2. Fetch + Blob     │ │ │ │
│  │                │ │ Google  │ │   │  │ 3. WebRequest       │ │ │ │
│  │                │ │ OneDrive│ │   │  │ 4. Button Trigger   │ │ │ │
│  │                │ │ Dropbox │ │   │  └─────────────────────┘ │ │ │
│  │                │ │ Box     │ │   └──────────────────────────┘ │ │
│  │                │ └─────────┘ │                                 │ │
│  │                └─────────────┘                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│  ┌───────────────────────────▼────────────────────────────────────┐ │
│  │                    Content Scripts                             │ │
│  │  ┌──────────────────┐  ┌────────────────────────────────────┐ │ │
│  │  │  DOM Scraper     │  │  Download Button Trigger           │ │ │
│  │  │  (find URLs)     │  │  (click native button)             │ │ │
│  │  └──────────────────┘  └────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Downloaded file path
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Native Host (unchanged from V1)                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Decisions

**Decision: Content scripts for DOM access**
- **Rationale**: Need to scrape download URLs from page, trigger buttons
- **Trade-offs**: More permissions required in manifest
- **Alternatives**: Only support services with predictable URL patterns

**Decision: Multiple download strategies**
- **Rationale**: Services vary in how downloads work
- **Trade-offs**: More complex code, more testing needed
- **Alternatives**: Only support "easy" services

**Decision: No OAuth**
- **Rationale**: Browser session provides authentication
- **Trade-offs**: Won't work if user isn't logged in
- **Alternatives**: Full OAuth (unnecessary complexity)

---

## Risks

### Technical Risks

**Risk**: Service changes DOM structure or download mechanism
- **Impact**: High (breaks that service)
- **Likelihood**: Medium (UIs change)
- **Mitigation**: Multiple fallback strategies, easy to update patterns
- **Fallback**: Disable service until fixed, guide user to manual download

**Risk**: Content script blocked by CSP
- **Impact**: High (can't scrape DOM)
- **Likelihood**: Low (extensions have special CSP handling)
- **Mitigation**: Test thoroughly, use `webRequest` as backup
- **Fallback**: Rely on URL patterns only

**Risk**: Download requires additional user action (e.g., CAPTCHA)
- **Impact**: Medium (flow interrupted)
- **Likelihood**: Low (rare for logged-in users)
- **Mitigation**: Detect and inform user
- **Fallback**: Guide to manual download

### Scope Risks

**Risk**: Users want more services (Notion, Confluence, etc.)
- **Impact**: Low (scope creep)
- **Likelihood**: High
- **Mitigation**: Service abstraction makes adding new services easy
- **Fallback**: Prioritize by user demand

---

## Appendix

### URL Pattern Examples

**OneDrive Personal**:
```
https://onedrive.live.com/edit.aspx?resid=ABC123!456&app=Excel
https://1drv.ms/x/s!ABC123
```

**SharePoint/OneDrive Business**:
```
https://company.sharepoint.com/:x:/g/personal/user/ABC123
https://company-my.sharepoint.com/personal/user/_layouts/15/Doc.aspx?sourcedoc=...
```

**Dropbox**:
```
https://www.dropbox.com/s/abc123/document.xlsx?dl=0
https://www.dropbox.com/scl/fi/abc123/document.xlsx?rlkey=xyz
https://www.dropbox.com/home/Documents/document.xlsx
```

**Box**:
```
https://app.box.com/file/123456789
https://app.box.com/s/abc123xyz
https://company.app.box.com/file/123456789
```

### Glossary
- **Content Script**: Extension script that runs in the context of web pages
- **WebRequest API**: Chrome API for intercepting and modifying network requests
- **DOM Scraping**: Extracting data from a page's HTML structure

### Open Questions
- Should we support Google Drive (non-Workspace files like PDFs)? (Probably yes, easy addition)
- Should we support iCloud? (Research needed on web interface)
- How to handle files that require "request access"? (Show error, can't bypass)

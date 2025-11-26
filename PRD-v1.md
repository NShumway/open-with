# Reclaim: Open With — V1 PRD

**Scope:** Google Workspace only (Sheets, Docs, Slides)

---

## Problem Statement

Users viewing Google Docs, Sheets, or Slides must manually navigate File → Download → choose format → wait → find file → open. This friction discourages local editing, trapping users in browser-based workflows even when they prefer desktop applications.

## Target Users

- **Power users** who prefer native apps (Excel over Sheets, Word over Docs)
- **Offline workers** who need local copies for travel/poor connectivity
- **Cross-tool workflows** — users who need to paste spreadsheet data into other apps

## Success Metrics

- Context menu appears on 100% of Google Docs/Sheets/Slides pages
- File opens in default app within 3 seconds of click
- Zero user configuration required after install
- Works across Chrome, Brave, Edge, Arc browsers

---

## Functional Decomposition

### Capability: Site Detection

Determines if the current page is a supported Google Workspace document and extracts the document ID.

#### Feature: URL Pattern Matching
- **Description**: Match current URL against known Google Workspace patterns
- **Inputs**: Current tab URL
- **Outputs**: Boolean (is supported site) + document type (sheets/docs/slides)
- **Behavior**: Regex match against `docs.google.com/(spreadsheets|document|presentation)/d/{id}`

#### Feature: Document ID Extraction
- **Description**: Extract the document ID from the URL for export URL construction
- **Inputs**: Matched URL
- **Outputs**: Document ID string
- **Behavior**: Capture group from regex, validate format (alphanumeric + hyphens)

### Capability: Export URL Construction

Builds the download URL for Google's export API.

#### Feature: Format Selection
- **Description**: Map document type to appropriate export format
- **Inputs**: Document type (sheets/docs/slides)
- **Outputs**: File extension and MIME type
- **Behavior**: sheets→xlsx, docs→docx, slides→pptx

#### Feature: URL Generation
- **Description**: Construct the full export URL
- **Inputs**: Document ID, export format
- **Outputs**: Complete export URL
- **Behavior**: Template: `https://docs.google.com/{type}/d/{id}/export?format={format}`

### Capability: File Download

Downloads the exported file using Chrome's downloads API.

#### Feature: Download Initiation
- **Description**: Trigger file download via Chrome API
- **Inputs**: Export URL, suggested filename
- **Outputs**: Download ID
- **Behavior**: Call `chrome.downloads.download()`, handle auth via existing session cookies

#### Feature: Download Monitoring
- **Description**: Track download progress and completion
- **Inputs**: Download ID
- **Outputs**: File path on completion, error on failure
- **Behavior**: Listen to `chrome.downloads.onChanged`, resolve on complete, reject on error/timeout

#### Feature: Error Handling
- **Description**: Handle download failures gracefully
- **Inputs**: Error type (403, timeout, network)
- **Outputs**: User-facing error message
- **Behavior**: 403 → "Downloads disabled by owner", timeout → "Try manual download", network → "Check connection"

### Capability: Native Messaging

Communicates with the native host to open files in desktop apps.

#### Feature: Host Connection
- **Description**: Establish connection to native messaging host
- **Inputs**: Host name (`com.reclaim.openwith`)
- **Outputs**: Connection status
- **Behavior**: Call `chrome.runtime.connectNative()`, handle connection errors

#### Feature: Default App Query
- **Description**: Query native host for default applications per file type
- **Inputs**: None (queries all supported types)
- **Outputs**: Map of file extension → app name
- **Behavior**: Send `getDefaults` action, receive app names for context menu labels

#### Feature: File Open Request
- **Description**: Request native host to open downloaded file
- **Inputs**: File path, file type
- **Outputs**: Success/failure
- **Behavior**: Send `open` action, host opens file directly from Downloads folder

### Capability: Context Menu

Provides the right-click "Open in [App]" menu item.

#### Feature: Menu Registration
- **Description**: Register context menu items on extension install
- **Inputs**: Default app names from native host
- **Outputs**: Registered menu IDs
- **Behavior**: Create menu per document type with dynamic label ("Open in Excel")

#### Feature: Menu Visibility
- **Description**: Show/hide menu based on current URL
- **Inputs**: Current tab URL
- **Outputs**: Menu visibility state
- **Behavior**: Use `documentUrlPatterns` to limit to Google Workspace URLs

#### Feature: Menu Click Handler
- **Description**: Handle user clicking the context menu item
- **Inputs**: Menu item ID, tab info
- **Outputs**: Triggers download flow
- **Behavior**: Extract doc ID → build export URL → download → send to native host

### Capability: Native Host Operations

The Go binary that interfaces with the OS to open files.

#### Feature: Default App Resolution
- **Description**: Query macOS for default application per file type
- **Inputs**: File extension
- **Outputs**: App name and bundle ID
- **Behavior**: Use Launch Services or `open -b` to resolve defaults

#### Feature: App Launch
- **Description**: Open file in default application
- **Inputs**: File path (in Downloads folder)
- **Outputs**: Success/failure
- **Behavior**: Execute `open {filepath}` to launch default application

#### Feature: Error Reporting
- **Description**: Return structured errors to extension
- **Inputs**: Error condition
- **Outputs**: JSON error response
- **Behavior**: `no_default_app`, `file_not_found`, `permission_denied` error codes

---

## Structural Decomposition

```
project-root/
├── extension/                    # Chrome Extension (MV3)
│   ├── src/
│   │   ├── background/           # Service worker
│   │   │   ├── index.ts          # Main entry, event listeners
│   │   │   ├── site-registry.ts  # URL patterns, export URL builders
│   │   │   ├── downloader.ts     # Download management
│   │   │   ├── native-client.ts  # Native messaging wrapper
│   │   │   └── context-menu.ts   # Menu registration and handlers
│   │   └── types/
│   │       └── messages.ts       # Shared type definitions
│   ├── manifest.json
│   └── package.json
│
├── native-host/                  # Go Native Messaging Host
│   ├── cmd/
│   │   └── reclaim-openwith/
│   │       └── main.go           # Entry point, message loop
│   ├── internal/
│   │   ├── messaging/
│   │   │   ├── protocol.go       # JSON message parsing
│   │   │   └── stdio.go          # Length-prefixed I/O
│   │   ├── platform/
│   │   │   ├── platform.go       # Interface definition
│   │   │   ├── darwin.go         # macOS implementation
│   │   │   └── darwin_test.go
│   │   └── handlers/
│   │       ├── defaults.go       # getDefaults handler
│   │       └── open.go           # open handler
│   ├── go.mod
│   └── go.sum
│
├── installer/                    # macOS installer
│   ├── scripts/
│   │   ├── postinstall           # Install manifests
│   │   └── preinstall            # Cleanup old versions
│   └── build.sh                  # pkgbuild script
│
└── docs/
    └── PRD-v1.md
```

### Module: background (Extension Service Worker)
- **Maps to capability**: Site Detection, Export URL Construction, Context Menu
- **Responsibility**: Orchestrate the export flow from menu click to native host
- **Exports**:
  - Event listeners for `chrome.contextMenus.onClicked`
  - Event listeners for `chrome.runtime.onInstalled`

### Module: site-registry
- **Maps to capability**: Site Detection, Export URL Construction
- **Responsibility**: Define supported sites and their export URL patterns
- **Exports**:
  - `getSiteConfig(url: string): SiteConfig | null`
  - `buildExportUrl(config: SiteConfig, docId: string): string`

### Module: downloader
- **Maps to capability**: File Download
- **Responsibility**: Manage Chrome downloads API interactions
- **Exports**:
  - `downloadFile(url: string, filename: string): Promise<string>` (returns file path)

### Module: native-client
- **Maps to capability**: Native Messaging
- **Responsibility**: Communicate with native host
- **Exports**:
  - `getDefaults(): Promise<DefaultApps>`
  - `openFile(path: string, type: string): Promise<OpenResult>`

### Module: context-menu
- **Maps to capability**: Context Menu
- **Responsibility**: Register and handle context menu
- **Exports**:
  - `registerMenus(defaults: DefaultApps): void`
  - `handleMenuClick(info: MenuInfo, tab: Tab): Promise<void>`

### Module: messaging (Native Host)
- **Maps to capability**: Native Host Operations (protocol)
- **Responsibility**: Parse/serialize native messaging protocol
- **Exports**:
  - `ReadMessage() (Message, error)`
  - `WriteMessage(msg Message) error`

### Module: platform (Native Host)
- **Maps to capability**: Native Host Operations (OS interface)
- **Responsibility**: Abstract OS-specific operations
- **Exports**:
  - `GetDefaultApp(ext string) (AppInfo, error)`
  - `OpenWithDefault(path string) error`

### Module: handlers (Native Host)
- **Maps to capability**: Native Host Operations (business logic)
- **Responsibility**: Implement getDefaults and open actions
- **Exports**:
  - `HandleGetDefaults() Response`
  - `HandleOpen(req OpenRequest) Response`

---

## Dependency Graph

### Foundation Layer (Phase 0)
No dependencies - these are built first.

- **types/messages.ts**: Shared TypeScript types for messages
- **messaging (Go)**: Native messaging protocol I/O
- **platform (Go)**: OS abstraction interface

### Data Layer (Phase 1)
- **site-registry**: Depends on [types/messages]
- **native-client**: Depends on [types/messages]
- **handlers (Go)**: Depends on [messaging, platform]

### Core Layer (Phase 2)
- **downloader**: Depends on [types/messages]
- **context-menu**: Depends on [site-registry, native-client]

### Integration Layer (Phase 3)
- **background/index.ts**: Depends on [context-menu, downloader, native-client, site-registry]
- **main.go**: Depends on [messaging, handlers]

### Distribution Layer (Phase 4)
- **installer**: Depends on [main.go compiled binary]
- **manifest.json**: Depends on [all extension modules]

---

## Implementation Roadmap

### Phase 0: Foundation
**Goal**: Establish type definitions and low-level I/O

**Entry Criteria**: Clean repository with build tooling configured

**Tasks**:
- [ ] Define TypeScript message types (depends on: none)
  - Acceptance: Types compile, match native host protocol
  - Test: Type checking passes

- [ ] Implement Go native messaging I/O (depends on: none)
  - Acceptance: Can read/write length-prefixed JSON
  - Test: Unit tests with mock stdin/stdout

- [ ] Implement macOS platform abstraction (depends on: none)
  - Acceptance: GetDefaultApp returns real app names
  - Test: Integration test on macOS

**Exit Criteria**: All foundation modules pass unit tests

**Delivers**: Buildable but non-functional skeleton

---

### Phase 1: Native Host Complete
**Goal**: Fully functional native host binary

**Entry Criteria**: Phase 0 complete

**Tasks**:
- [ ] Implement getDefaults handler (depends on: [messaging, platform])
  - Acceptance: Returns correct default apps for xlsx/docx/pptx
  - Test: Query real system, verify app names

- [ ] Implement open handler (depends on: [messaging, platform])
  - Acceptance: Opens file directly from Downloads in default app
  - Test: End-to-end with test file

- [ ] Implement main.go message loop (depends on: [handlers])
  - Acceptance: Processes stdin messages, writes responses
  - Test: Integration test with mock extension

**Exit Criteria**: Native host can be invoked manually and opens files

**Delivers**: Working native host binary (not yet integrated)

---

### Phase 2: Extension Core
**Goal**: Extension modules without UI integration

**Entry Criteria**: Phase 1 complete (native host works)

**Tasks**:
- [ ] Implement site-registry (depends on: [types])
  - Acceptance: Correctly identifies Google Workspace URLs
  - Test: Unit tests with various URL patterns

- [ ] Implement native-client (depends on: [types])
  - Acceptance: Communicates with native host
  - Test: Integration test with real native host

- [ ] Implement downloader (depends on: [types])
  - Acceptance: Downloads file, returns path on complete
  - Test: Mock Chrome API, verify flow

**Exit Criteria**: All extension modules pass unit tests

**Delivers**: Tested modules ready for integration

---

### Phase 3: Integration
**Goal**: End-to-end working extension

**Entry Criteria**: Phase 2 complete

**Tasks**:
- [ ] Implement context-menu registration (depends on: [native-client, site-registry])
  - Acceptance: Menu appears on Google Docs pages
  - Test: Manual verification in browser

- [ ] Implement menu click handler (depends on: [context-menu, downloader, native-client])
  - Acceptance: Click → download → open in app
  - Test: End-to-end manual test

- [ ] Implement background service worker (depends on: [all extension modules])
  - Acceptance: Extension loads without errors
  - Test: Load unpacked extension, verify functionality

**Exit Criteria**: Right-click on Google Sheet opens in Excel

**Delivers**: Functional extension (dev mode)

---

### Phase 4: Distribution
**Goal**: Installable packages for end users

**Entry Criteria**: Phase 3 complete

**Tasks**:
- [ ] Build native host binary (depends on: [main.go])
  - Acceptance: Single static binary, no dependencies
  - Test: Run on clean macOS system

- [ ] Create installer package (depends on: [binary])
  - Acceptance: .pkg installs binary and manifests
  - Test: Install on clean system, verify paths

- [ ] Finalize manifest.json (depends on: [all extension modules])
  - Acceptance: Extension ID stable, permissions minimal
  - Test: Load in Chrome, verify permissions prompt

**Exit Criteria**: User can install .pkg and load extension

**Delivers**: V1 release candidate

---

## Test Strategy

### Test Pyramid

```
        /\
       /E2E\       ← 10% (Full flow: menu click to app open)
      /------\
     /Integration\ ← 30% (Native host + extension, Chrome APIs)
    /------------\
   /  Unit Tests  \ ← 60% (Site registry, URL builders, handlers)
  /----------------\
```

### Coverage Requirements
- Line coverage: 80% minimum
- Branch coverage: 70% minimum
- All error paths must have tests

### Critical Test Scenarios

#### Site Registry
**Happy path**:
- Google Sheets URL → returns sheets config
- Google Docs URL → returns docs config
- Expected: Correct document type and ID extraction

**Edge cases**:
- URL with query params (`?usp=sharing`)
- URL with fragment (`#gid=0`)
- Expected: Still extracts correct ID

**Error cases**:
- Non-Google URL
- Malformed Google URL
- Expected: Returns null, no crash

#### Native Host - Open Handler
**Happy path**:
- Valid xlsx file in Downloads
- Expected: Opens directly in Excel from Downloads folder

**Edge cases**:
- File with spaces in name
- Very long filename
- Expected: Handles correctly

**Error cases**:
- File doesn't exist
- No default app for type
- Expected: Returns appropriate error code

#### Download Flow
**Happy path**:
- Public Google Sheet
- Expected: Downloads within 10 seconds

**Error cases**:
- 403 (downloads disabled)
- Network timeout
- Expected: User-friendly error message

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension (MV3)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Service Worker                          │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌────────────┐  │  │
│  │  │ Context │→ │   Site   │→ │Download│→ │  Native    │  │  │
│  │  │  Menu   │  │ Registry │  │   er   │  │  Client    │  │  │
│  │  └─────────┘  └──────────┘  └────────┘  └─────┬──────┘  │  │
│  └───────────────────────────────────────────────┼──────────┘  │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │ stdio/JSON
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Native Host (Go Binary)                      │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Messaging │→ │   Handlers   │→ │   Platform (darwin)     │  │
│  │  (stdio)  │  │ get/open     │  │ Launch Services, open   │  │
│  └───────────┘  └──────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Extension:**
- TypeScript (strict mode)
- Chrome Extension Manifest V3
- esbuild for bundling

**Native Host:**
- Go 1.21+
- No CGo (pure Go for simple cross-compilation)
- Static binary

**Decision: Pure Go (no CGo)**
- **Rationale**: Simpler build, no Xcode dependency
- **Trade-offs**: Can't use Launch Services directly, use `open` command instead
- **Alternatives considered**: CGo with CoreFoundation bindings

**Decision: Manifest V3**
- **Rationale**: Required for Chrome Web Store, future-proof
- **Trade-offs**: Service worker model, no persistent background page
- **Alternatives considered**: MV2 (deprecated)

---

## Risks

### Technical Risks

**Risk**: Chrome downloads API doesn't return full file path
- **Impact**: High (breaks core flow)
- **Likelihood**: Low (documented behavior)
- **Mitigation**: Test on all target browsers early
- **Fallback**: Use known Downloads folder path + filename

**Risk**: User expects "Save As" behavior but file saves to Downloads
- **Impact**: Low (minor UX confusion)
- **Likelihood**: Medium
- **Mitigation**: Document behavior clearly
- **Fallback**: Users can use File > Save As manually

### Dependency Risks

**Risk**: Google changes export URL format
- **Impact**: High (breaks export)
- **Likelihood**: Low (stable for years)
- **Mitigation**: Version URLs in config, easy to update
- **Fallback**: Detect failure, prompt manual download

### Scope Risks

**Risk**: Users request Office 365 support in V1
- **Impact**: Low (scope creep)
- **Likelihood**: High
- **Mitigation**: Clear V1/V1.5/V2 scoping, documented roadmap
- **Fallback**: Point to PRD-v1.5.md

---

## Appendix

### Glossary
- **Native Messaging Host**: Binary that Chrome can invoke for privileged operations
- **MV3**: Manifest Version 3, Chrome's current extension format
- **Service Worker**: Background script model in MV3 (replaces persistent pages)

### Open Questions
- Should we support Google Drawings? (Likely no - low usage)
- Should "Open in Preview" be an option for PDF export of Slides? (V2 consideration)

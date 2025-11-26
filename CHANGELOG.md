# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-XX-XX

### Added

- Initial release of Reclaim: Open With
- Context menu integration for Google Workspace documents
  - Google Sheets: Export and open as .xlsx
  - Google Docs: Export and open as .docx
  - Google Slides: Export and open as .pptx
- Native macOS messaging host for opening files with default applications
- Support for multiple Chromium-based browsers:
  - Google Chrome
  - Google Chrome Beta
  - Google Chrome Canary
  - Brave Browser
  - Microsoft Edge
  - Chromium
  - Vivaldi
  - Arc
- Progress indicator (badge) during download and open operations
- Error notifications for common issues:
  - Downloads disabled by document owner
  - Network errors
  - Missing default applications
- macOS installer package (.pkg) with:
  - Universal binary (Intel + Apple Silicon)
  - Multi-user support
  - Automatic manifest installation for all supported browsers
- Uninstaller script for clean removal
- Comprehensive documentation (README, TESTING)

### Technical Details

- Chrome Extension Manifest V3
- TypeScript for extension code
- Go for native messaging host (pure Go, no CGo)
- Native messaging protocol with length-prefixed JSON
- Platform abstraction layer for future cross-platform support

### Security

- Minimal permissions (contextMenus, downloads, nativeMessaging, notifications)
- Host permissions limited to docs.google.com
- No external data collection
- All processing happens locally

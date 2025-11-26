# Testing Checklist

## Pre-requisites

- [ ] Extension built: `cd extension && npm run build`
- [ ] Native host built: `cd native-host && make build`
- [ ] Native host installed for development extension ID
- [ ] Extension loaded in browser as unpacked

## Browser Compatibility Matrix

### Chrome (Primary)

| Test Case | Status | Notes |
|-----------|--------|-------|
| Google Sheets - Public doc | [ ] | |
| Google Docs - Public doc | [ ] | |
| Google Slides - Public doc | [ ] | |
| Google Sheets - Download disabled (403) | [ ] | Should show error notification |
| Google Sheets - Very large file (>5MB) | [ ] | May take longer, badge should show progress |
| Google Docs - Special characters in title | [ ] | Unicode, spaces, etc. |
| Google Workspace URL (/u/0/d/) | [ ] | Multi-account format |

### Brave

| Test Case | Status | Notes |
|-----------|--------|-------|
| Google Sheets - Public doc | [ ] | |
| Google Docs - Public doc | [ ] | |
| Google Slides - Public doc | [ ] | |

### Microsoft Edge

| Test Case | Status | Notes |
|-----------|--------|-------|
| Google Sheets - Public doc | [ ] | |
| Google Docs - Public doc | [ ] | |
| Google Slides - Public doc | [ ] | |

### Arc (if installed)

| Test Case | Status | Notes |
|-----------|--------|-------|
| Google Sheets - Public doc | [ ] | |

## Test Procedure

For each test case:

1. [ ] Navigate to the Google document URL
2. [ ] Right-click anywhere on the page
3. [ ] Verify context menu shows "Open in [App Name]"
4. [ ] Click the menu item
5. [ ] Verify badge shows "..." (progress indicator)
6. [ ] Verify file downloads (check ~/Downloads or temp)
7. [ ] Verify correct application opens
8. [ ] Verify file content matches original document
9. [ ] Verify badge clears on success
10. [ ] Check console for errors (`chrome://extensions` > background page > Console)

## Error Scenario Testing

### Download Disabled Document

1. [ ] Navigate to a document where owner disabled downloads
2. [ ] Right-click > "Open in..."
3. [ ] Verify error notification appears
4. [ ] Verify message mentions downloads are disabled
5. [ ] Verify badge shows "!" (error indicator)

### Network Offline

1. [ ] Navigate to a Google document
2. [ ] Disable network (Wi-Fi off or airplane mode)
3. [ ] Right-click > "Open in..."
4. [ ] Verify appropriate network error message

### No Default App

1. [ ] Remove default app association for .xlsx
2. [ ] Try to open a Google Sheet
3. [ ] Verify graceful error handling

### Invalid URL (Edge Case)

1. [ ] Navigate to `docs.google.com` homepage (not a document)
2. [ ] Verify no context menu appears (or menu is disabled)

## Native Host Testing

```bash
# Test native host responds correctly
echo '{"action":"getDefaults"}' | /usr/local/bin/reclaim-openwith

# Check log file for errors
cat /tmp/reclaim-openwith.log
```

### Expected getDefaults Response

```json
{
  "success": true,
  "defaults": {
    "xlsx": {"name": "Microsoft Excel", "bundleId": "com.microsoft.Excel"},
    "docx": {"name": "Microsoft Word", "bundleId": "com.microsoft.Word"},
    "pptx": {"name": "Microsoft PowerPoint", "bundleId": "com.microsoft.Powerpoint"},
    "txt": {"name": "TextEdit", "bundleId": "com.apple.TextEdit"},
    "pdf": {"name": "Preview", "bundleId": "com.apple.Preview"}
  }
}
```

## Installation Testing

### Fresh Install

1. [ ] Start with clean system (no previous installation)
2. [ ] Build package: `./installer/build-pkg.sh --universal`
3. [ ] Install: `sudo installer -pkg installer/dist/reclaim-openwith-1.0.0.pkg -target /`
4. [ ] Verify binary: `ls -la /usr/local/bin/reclaim-openwith`
5. [ ] Verify manifest in Chrome: `cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.reclaim.openwith.json`
6. [ ] Load extension and test

### Upgrade Install

1. [ ] With v1.0.0 installed, build v1.0.1
2. [ ] Install new package
3. [ ] Verify old files removed
4. [ ] Verify new files in place
5. [ ] Test extension still works

### Uninstall

1. [ ] Run: `sudo ./installer/uninstall.sh`
2. [ ] Verify binary removed
3. [ ] Verify manifests removed from all browser directories
4. [ ] Verify package receipt forgotten

## Performance Testing

| Metric | Target | Actual |
|--------|--------|--------|
| Context menu appears | < 100ms | |
| Small doc open (< 1MB) | < 5s | |
| Large doc open (5MB+) | < 30s | |
| Extension bundle size | < 100KB | |
| Native host binary | < 5MB | |

## macOS Version Compatibility

| macOS Version | Status | Notes |
|---------------|--------|-------|
| macOS 12 (Monterey) | [ ] | |
| macOS 13 (Ventura) | [ ] | |
| macOS 14 (Sonoma) | [ ] | |
| macOS 15 (Sequoia) | [ ] | |

## Security Checklist

- [ ] Extension only requests necessary permissions
- [ ] No data sent to external servers
- [ ] Native host validates all input
- [ ] Temp files cleaned up appropriately
- [ ] No secrets in source code

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |

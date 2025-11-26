// Reclaim: Open With - Background Service Worker
// Entry point for the Chrome extension
// Orchestrates URL detection, file download, and native app launching

import { openFile, NativeMessagingError } from './native-client';
import { registerContextMenus, isOurMenuItem } from './context-menu';
import {
  getSiteConfig,
  extractDocumentId,
  buildExportUrl,
} from './site-registry';
import { downloadFile, generateFilename, DownloadError } from './downloader';
import { refreshDefaultApps, getOpenInTitle } from './app-defaults';

console.log('Reclaim: Open With extension loaded');

/**
 * Set up declarative content rules to only show the action on supported pages
 */
async function setupDeclarativeContent(): Promise<void> {
  // Clear existing rules
  await chrome.declarativeContent.onPageChanged.removeRules(undefined);

  // Add rules to enable action only on Google Docs/Sheets/Slides
  await chrome.declarativeContent.onPageChanged.addRules([
    {
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostEquals: 'docs.google.com', pathContains: '/document/d/' },
        }),
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostEquals: 'docs.google.com', pathContains: '/spreadsheets/d/' },
        }),
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostEquals: 'docs.google.com', pathContains: '/presentation/d/' },
        }),
      ],
      actions: [new chrome.declarativeContent.ShowAction()],
    },
  ]);
}

/**
 * Update the action title based on the current tab's URL
 * Shows "Open in [AppName]" for supported pages
 */
async function updateActionTitle(tabId: number, url: string | undefined): Promise<void> {
  if (!url) {
    return;
  }

  const config = getSiteConfig(url);
  if (!config) {
    // Not a supported page - use default title
    await chrome.action.setTitle({ tabId, title: 'Open in desktop app' });
    return;
  }

  await chrome.action.setTitle({ tabId, title: getOpenInTitle(config.fileType) });
}

/**
 * Listen for tab activation to update the action title
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await updateActionTitle(activeInfo.tabId, tab.url);
  } catch {
    // Tab may have been closed
  }
});

/**
 * Listen for tab URL changes to update the action title
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only update when URL changes or page finishes loading
  if (changeInfo.url || changeInfo.status === 'complete') {
    await updateActionTitle(tabId, tab.url);
  }
});

/**
 * Initialize extension on install or update
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');

  // Set up declarative content to only show icon on supported pages
  await setupDeclarativeContent();

  try {
    await refreshDefaultApps();
    await registerContextMenus();
    console.log('Context menus registered successfully');
  } catch (error) {
    console.error('Failed to initialize extension:', error);

    // Show notification about setup required
    if (error instanceof NativeMessagingError) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Setup Required',
        message: error.message,
      });
    }
  }
});

/**
 * Re-register menus on browser startup (service worker may have been stopped)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started, re-registering menus');

  try {
    await refreshDefaultApps();
    await registerContextMenus();
  } catch (error) {
    console.error('Failed to register menus on startup:', error);
  }
});

/**
 * Handle toolbar icon clicks
 * Opens the current document in the appropriate desktop app
 * Note: Icon is only visible/clickable on supported pages due to declarativeContent rules
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !tab.url) {
    console.error('No tab information available');
    return;
  }

  const config = getSiteConfig(tab.url);
  if (!config) {
    // Shouldn't happen due to declarativeContent, but handle gracefully
    console.error('Toolbar clicked on unsupported page:', tab.url);
    return;
  }

  const tabId = tab.id;

  try {
    await updateBadge(tabId, 'progress');

    const documentId = extractDocumentId(tab.url, config);
    if (!documentId) {
      throw new Error('Could not identify the document from the URL');
    }

    const exportUrl = buildExportUrl(config, documentId);
    const filename = generateFilename(documentId, config.fileType);

    console.log(`Downloading ${config.name}: ${documentId}`);

    const { filePath } = await downloadFile({
      url: exportUrl,
      filename,
      fileType: config.fileType,
    });

    console.log(`Downloaded to: ${filePath}`);

    await openFile(filePath, config.fileType);

    console.log('Opened in default application');

    await updateBadge(tabId, 'success');
  } catch (error) {
    console.error('Failed to open document:', error);
    await handleError(tabId, error);
  }
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Ignore menu items from other extensions
  if (!isOurMenuItem(info.menuItemId)) {
    return;
  }

  if (!tab?.id || !tab.url) {
    console.error('No tab information available');
    return;
  }

  const tabId = tab.id;

  try {
    // Show progress indicator
    await updateBadge(tabId, 'progress');

    // Get site config and extract document ID
    const config = getSiteConfig(tab.url);
    if (!config) {
      throw new Error('This page is not a supported Google document');
    }

    const documentId = extractDocumentId(tab.url, config);
    if (!documentId) {
      throw new Error('Could not identify the document from the URL');
    }

    // Build export URL and download
    const exportUrl = buildExportUrl(config, documentId);
    const filename = generateFilename(documentId, config.fileType);

    console.log(`Downloading ${config.name}: ${documentId}`);

    const { filePath } = await downloadFile({
      url: exportUrl,
      filename,
      fileType: config.fileType,
    });

    console.log(`Downloaded to: ${filePath}`);

    // Send to native host to open in default app
    await openFile(filePath, config.fileType);

    console.log('Opened in default application');

    // Clear badge on success
    await updateBadge(tabId, 'success');
  } catch (error) {
    console.error('Failed to open document:', error);
    await handleError(tabId, error);
  }
});

/**
 * Update the extension badge to show status
 */
async function updateBadge(
  tabId: number,
  status: 'progress' | 'success' | 'error'
): Promise<void> {
  switch (status) {
    case 'progress':
      await chrome.action.setBadgeText({ text: '...', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId });
      break;
    case 'success':
      await chrome.action.setBadgeText({ text: '', tabId });
      break;
    case 'error':
      await chrome.action.setBadgeText({ text: '!', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#ea4335', tabId });
      // Clear error badge after 5 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId }).catch(() => {
          // Tab may have been closed
        });
      }, 5000);
      break;
  }
}

/**
 * Handle errors and show appropriate notifications
 */
async function handleError(tabId: number, error: unknown): Promise<void> {
  await updateBadge(tabId, 'error');

  let title = 'Failed to open document';
  let message = 'An unexpected error occurred';

  if (error instanceof DownloadError) {
    switch (error.code) {
      case 'forbidden':
        title = 'Download blocked';
        message = error.message;
        break;
      case 'timeout':
        title = 'Download timed out';
        message = 'The file is too large or the connection is slow. Try again.';
        break;
      case 'network':
        title = 'Network error';
        message = error.message;
        break;
      default:
        message = error.message;
    }
  } else if (error instanceof NativeMessagingError) {
    switch (error.code) {
      case 'host_not_found':
        title = 'Setup required';
        message = error.message;
        break;
      case 'no_default_app':
        title = 'No app configured';
        message = `No application is set to open ${error.fileType} files`;
        break;
      default:
        message = error.message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-48.png',
    title,
    message,
  });
}

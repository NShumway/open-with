// Reclaim: Open With - Background Service Worker
// Entry point for the Chrome extension
// Orchestrates URL detection, file download, and native app launching

import { openFile, NativeMessagingError } from './native-client';
import {
  getSiteConfig,
  extractDocumentId,
  buildExportUrl,
} from './site-registry';
import { downloadFile, generateFilename, DownloadError } from './downloader';

console.log('Reclaim: Open With extension loaded');

// Cached error for popup display
interface CachedError {
  title: string;
  message: string;
  tabId: number;
  timestamp: number;
}

let cachedError: CachedError | null = null;

// Message types from popup
interface OpenDocumentMessage {
  action: 'openDocument';
  tabId: number;
}

interface GetErrorMessage {
  action: 'getError';
}

interface ClearErrorMessage {
  action: 'clearError';
}

type PopupMessage = OpenDocumentMessage | GetErrorMessage | ClearErrorMessage;

/**
 * Handle opening a document for a given tab
 * Used by popup message handler
 */
async function handleOpenDocument(tabId: number, url: string, tabTitle: string): Promise<void> {
  const config = getSiteConfig(url);
  if (!config) {
    throw new Error('This page is not a supported Google document');
  }

  await updateBadge(tabId, 'progress');

  const documentId = extractDocumentId(url, config);
  if (!documentId) {
    throw new Error('Could not identify the document from the URL');
  }

  const exportUrl = buildExportUrl(config, documentId);
  const filename = generateFilename(tabTitle, documentId, config.fileType);

  console.log(`Downloading ${config.name}: ${documentId} as ${filename}`);

  const { filePath } = await downloadFile({
    url: exportUrl,
    filename,
    fileType: config.fileType,
  });

  console.log(`Downloaded to: ${filePath}`);

  await openFile(filePath, config.fileType);

  console.log('Opened in default application');

  await updateBadge(tabId, 'success');
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((message: PopupMessage, _sender, sendResponse) => {
  if (message.action === 'getError') {
    sendResponse({ error: cachedError });
    return false;
  }

  if (message.action === 'clearError') {
    if (cachedError) {
      const tabId = cachedError.tabId;
      cachedError = null;
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {
        // Tab may have been closed
      });
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'openDocument' && message.tabId) {
    // Get the tab URL and process the document
    chrome.tabs.get(message.tabId).then(async (tab) => {
      if (!tab.url) {
        console.error('No URL available for tab');
        return;
      }

      try {
        await handleOpenDocument(message.tabId, tab.url, tab.title || '');
      } catch (error) {
        console.error('Failed to open document:', error);
        await handleError(message.tabId, error);
      }
    }).catch((error) => {
      console.error('Failed to get tab:', error);
    });
  }

  // Return false to indicate we're not using sendResponse asynchronously
  return false;
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
      // Note: Badge auto-clear is handled in handleError with cached error timestamp
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

  // Cache error for popup display
  const timestamp = Date.now();
  cachedError = {
    title,
    message,
    tabId,
    timestamp,
  };

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
  });

  // Auto-clear after 30 seconds if error hasn't been viewed
  setTimeout(() => {
    if (cachedError && cachedError.timestamp === timestamp) {
      cachedError = null;
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {
        // Tab may have been closed
      });
    }
  }, 30000);
}

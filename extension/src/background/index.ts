// Reclaim: Open With - Background Service Worker
// Entry point for the Chrome extension
// Orchestrates URL detection, file download, and native app launching

import { openFile, NativeMessagingError } from './native-client';
import { detectService } from './services/index';
// Import site-registry to trigger service registration side-effect
import './site-registry';
import {
  downloadFile,
  downloadViaFetch,
  downloadViaContentScript,
  generateFilename,
  DownloadError,
} from './downloader';

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
  const detection = detectService(url);
  if (!detection) {
    throw new Error('This page is not a supported document service');
  }

  const { handler, info } = detection;

  await updateBadge(tabId, 'progress');

  // Get tab for services that need it (OneDrive, Box)
  const tab = await chrome.tabs.get(tabId);

  // Get download URL using service handler
  const downloadUrl = await handler.getDownloadUrl(info, tab);

  // Parse title using service-specific parser
  const title = handler.parseTitle(tabTitle);
  const filename = generateFilename(title, info.fileId, info.fileType);

  console.log(`Downloading ${handler.name}: ${info.fileId} as ${filename}`);

  // Select download strategy based on service
  let filePath: string;

  if (info.service === 'google' || info.service === 'dropbox') {
    // Strategy 1: Direct URL download
    const result = await downloadFile({
      url: downloadUrl,
      filename,
      fileType: info.fileType,
    });
    filePath = result.filePath;
  } else if (info.service === 'box') {
    // Strategy 2: Fetch+blob download for Box API
    const result = await downloadViaFetch(downloadUrl, filename);
    filePath = result.filePath;
  } else {
    // OneDrive - try direct first, fallback to content script
    try {
      const result = await downloadFile({
        url: downloadUrl,
        filename,
        fileType: info.fileType,
      });
      filePath = result.filePath;
    } catch (error) {
      console.warn('Direct download failed, trying content script fallback');
      const result = await downloadViaContentScript(
        tabId,
        'a[data-automationid="downloadButton"]'
      );
      filePath = result.filePath;
    }
  }

  console.log(`Downloaded to: ${filePath}`);

  await openFile(filePath, info.fileType);

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

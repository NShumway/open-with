// Content script for triggering downloads
// Injected into pages to click native download buttons

import { ContentScriptResponse } from '../types/services';

interface TriggerDownloadMessage {
  action: 'triggerDownload';
  selector: string;
}

/**
 * Set up listener for download trigger messages from the background script
 */
function setupDownloadTriggerListener(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: TriggerDownloadMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ContentScriptResponse) => void
    ) => {
      if (message.action === 'triggerDownload') {
        const result = triggerDownload(message.selector);
        sendResponse(result);
      }
      return true; // Keep message channel open for async response
    }
  );
}

/**
 * Find and click the download button matching the selector
 * @param selector - CSS selector for the download button
 * @returns Response indicating success or failure
 */
function triggerDownload(selector: string): ContentScriptResponse {
  const element = document.querySelector(selector);

  if (!element) {
    return {
      success: false,
      error: `Download button not found: ${selector}`,
    };
  }

  if (element instanceof HTMLElement) {
    element.click();
    return { success: true };
  }

  return {
    success: false,
    error: `Element is not clickable: ${selector}`,
  };
}

// Initialize the listener when loaded
setupDownloadTriggerListener();

console.log('[Open With] Download trigger content script loaded');

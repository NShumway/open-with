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
 * @param selector - CSS selector(s) for the download button (comma-separated)
 * @returns Response indicating success or failure
 */
function triggerDownload(selector: string): ContentScriptResponse {
  // Try combined selector first
  let element = document.querySelector(selector);

  // If not found, try each selector individually (handles case where commas are in attribute selectors)
  if (!element) {
    const selectors = selector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      element = document.querySelector(sel);
      if (element) break;
    }
  }

  if (!element) {
    // Log available buttons for debugging
    const allButtons = document.querySelectorAll('button, [role="button"], a[download]');
    console.log('[Open With] Available buttons:', Array.from(allButtons).map(b => ({
      tag: b.tagName,
      text: b.textContent?.slice(0, 50),
      'data-testid': b.getAttribute('data-testid'),
      'aria-label': b.getAttribute('aria-label'),
    })));

    return {
      success: false,
      error: `Download button not found: ${selector}`,
    };
  }

  if (element instanceof HTMLElement) {
    console.log('[Open With] Clicking download button:', element);
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

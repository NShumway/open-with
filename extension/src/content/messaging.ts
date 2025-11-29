// Content script messaging utilities
// Handles communication between background script and content scripts for DOM scraping

import { ContentScriptResponse, ScrapeDownloadUrlMessage } from '../types/services';

/** Timeout for content script responses (10 seconds) */
export const MESSAGING_TIMEOUT_MS = 10000;

/**
 * Send a message to a content script and wait for response
 * @param tabId - The tab ID to send the message to
 * @param message - The message to send
 * @returns Promise resolving to the content script response
 * @throws Error if messaging fails, times out, or response indicates failure
 */
export function sendToContentScript(
  tabId: number,
  message: ScrapeDownloadUrlMessage
): Promise<ContentScriptResponse> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Content script messaging timeout'));
      }
    }, MESSAGING_TIMEOUT_MS);

    // Send message
    chrome.tabs.sendMessage(tabId, message, (response: ContentScriptResponse | undefined) => {
      if (settled) return;
      settled = true;
      cleanup();

      // Check for Chrome runtime errors
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // Check for undefined response
      if (!response) {
        reject(new Error('No response from content script'));
        return;
      }

      // Check for error in response
      if (!response.success) {
        reject(new Error(response.error || 'Content script returned failure'));
        return;
      }

      resolve(response);
    });
  });
}

/**
 * Content script listener setup - call this in the content script context
 * Handles incoming messages and scrapes the DOM for download URLs
 */
export function setupContentScriptListener(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: ScrapeDownloadUrlMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ContentScriptResponse) => void
    ) => {
      if (message.action === 'scrapeDownloadUrl') {
        const result = scrapeDownloadUrl(message.selectors);
        sendResponse(result);
      }
      return true; // Keep message channel open for async response
    }
  );
}

/**
 * Scrape the current page for a download URL using the provided selectors
 * @param selectors - CSS selectors to try in order
 * @returns Response with download URL or error
 */
function scrapeDownloadUrl(selectors: string[]): ContentScriptResponse {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Try to get href from anchor element
      if (element instanceof HTMLAnchorElement && element.href) {
        return { success: true, downloadUrl: element.href };
      }
      // Try to get href from data attribute
      const dataHref = element.getAttribute('data-href') || element.getAttribute('href');
      if (dataHref) {
        return { success: true, downloadUrl: dataHref };
      }
    }
  }

  return {
    success: false,
    error: `Download URL not found. Tried selectors: ${selectors.join(', ')}`,
  };
}

// Download manager for Chrome downloads API
// Handles file downloads with progress monitoring and error handling
//
// Download strategies:
// 1. Direct URL (downloadFile) - Google, Dropbox
// 2. Fetch+Blob (downloadViaFetch) - Box API endpoints
// 3. Content Script (downloadViaContentScript) - OneDrive/Box fallback

import { FileType } from '../types/messages';
import { sendToContentScript } from '../content/messaging';

export interface DownloadOptions {
  url: string;
  filename: string;
  fileType: FileType;
}

export interface DownloadResult {
  filePath: string;
  downloadId: number;
}

export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'timeout'
      | 'forbidden'
      | 'network'
      | 'not_found'
      | 'unknown'
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

const DOWNLOAD_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Download a file using Chrome's downloads API
 * @param options - Download configuration
 * @returns Promise resolving to the download result with file path
 * @throws DownloadError on failure
 */
export async function downloadFile(
  options: DownloadOptions
): Promise<DownloadResult> {
  const { url, filename } = options;

  // Start download
  const downloadId = await chrome.downloads.download({
    url,
    filename,
    saveAs: false, // Don't prompt user
  });

  if (downloadId === undefined) {
    throw new DownloadError(
      'Failed to start download. Check browser permissions.',
      'unknown'
    );
  }

  // Wait for download to complete
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(
        new DownloadError(
          `Download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000} seconds. Try downloading manually.`,
          'timeout'
        )
      );
    }, DOWNLOAD_TIMEOUT_MS);

    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;

      // Check for completion
      if (delta.state?.current === 'complete') {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);

        // Query for file path
        chrome.downloads.search({ id: downloadId }, (results) => {
          if (results.length === 0 || !results[0].filename) {
            reject(
              new DownloadError(
                'Download completed but file path not found',
                'unknown'
              )
            );
            return;
          }
          resolve({
            filePath: results[0].filename,
            downloadId,
          });
        });
      }

      // Check for errors
      if (delta.state?.current === 'interrupted') {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);

        chrome.downloads.search({ id: downloadId }, (results) => {
          const error = results[0]?.error || 'unknown';
          reject(mapDownloadError(error));
        });
      }
    };

    chrome.downloads.onChanged.addListener(listener);
  });
}

/**
 * Wait for a download to complete and return the result
 * @param downloadId - The Chrome download ID to monitor
 * @returns Promise resolving to download result with file path
 * @throws DownloadError on failure or timeout
 */
export function waitForDownloadComplete(
  downloadId: number
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(
        new DownloadError(
          `Download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000} seconds. Try downloading manually.`,
          'timeout'
        )
      );
    }, DOWNLOAD_TIMEOUT_MS);

    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;

      // Check for completion
      if (delta.state?.current === 'complete') {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);

        // Query for file path
        chrome.downloads.search({ id: downloadId }, (results) => {
          if (results.length === 0 || !results[0].filename) {
            reject(
              new DownloadError(
                'Download completed but file path not found',
                'unknown'
              )
            );
            return;
          }
          resolve({
            filePath: results[0].filename,
            downloadId,
          });
        });
      }

      // Check for errors
      if (delta.state?.current === 'interrupted') {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);

        chrome.downloads.search({ id: downloadId }, (results) => {
          const error = results[0]?.error || 'unknown';
          reject(mapDownloadError(error));
        });
      }
    };

    chrome.downloads.onChanged.addListener(listener);
  });
}

/**
 * Download file using fetch API and blob conversion
 * Used when direct URL download doesn't work due to redirects (e.g., Box API)
 * @param url - API endpoint URL
 * @param filename - Suggested filename
 * @returns Download result with file path
 * @throws DownloadError on failure
 */
export async function downloadViaFetch(
  url: string,
  filename: string
): Promise<DownloadResult> {
  try {
    const response = await fetch(url, {
      credentials: 'include', // Send session cookies
      headers: {
        Accept: 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new DownloadError(
        `Fetch failed: ${response.status} ${response.statusText}`,
        'network'
      );
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      // Download blob using Chrome API
      const downloadId = await chrome.downloads.download({
        url: objectUrl,
        filename,
        saveAs: false,
      });

      if (downloadId === undefined) {
        throw new DownloadError(
          'Failed to start blob download. Check browser permissions.',
          'unknown'
        );
      }

      // Wait for download to complete
      const result = await waitForDownloadComplete(downloadId);
      return result;
    } finally {
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    if (error instanceof DownloadError) throw error;
    throw new DownloadError(`Fetch download failed: ${error}`, 'network');
  }
}

/**
 * Download file by triggering native download button via content script
 * Last resort fallback when URL-based downloads fail (OneDrive, Box)
 * @param tabId - Tab containing the file page
 * @param selector - CSS selector for download button
 * @returns Download result
 * @throws DownloadError on failure
 */
export async function downloadViaContentScript(
  tabId: number,
  selector: string
): Promise<DownloadResult> {
  // Inject content script
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['dist/content/download-trigger.js'],
  });

  // Listen for download start
  const downloadPromise = new Promise<number>((resolve, reject) => {
    const listener = (item: chrome.downloads.DownloadItem) => {
      chrome.downloads.onCreated.removeListener(listener);
      resolve(item.id);
    };
    chrome.downloads.onCreated.addListener(listener);

    setTimeout(() => {
      chrome.downloads.onCreated.removeListener(listener);
      reject(
        new DownloadError('Download not triggered within timeout', 'timeout')
      );
    }, 5000);
  });

  // Trigger download button click
  const response = await sendToContentScript(tabId, {
    action: 'scrapeDownloadUrl',
    selectors: [selector],
  });

  if (!response.success) {
    throw new DownloadError(
      response.error || 'Failed to trigger download button',
      'unknown'
    );
  }

  // Wait for download to start
  const downloadId = await downloadPromise;

  // Wait for completion
  return waitForDownloadComplete(downloadId);
}

/**
 * Map Chrome download error codes to user-friendly messages
 */
function mapDownloadError(error: string): DownloadError {
  if (error === 'SERVER_FORBIDDEN' || error === 'SERVER_UNAUTHORIZED') {
    return new DownloadError(
      'Downloads are disabled by the document owner. Ask them to enable downloads.',
      'forbidden'
    );
  }

  if (error.startsWith('NETWORK_')) {
    return new DownloadError(
      'Network error during download. Check your internet connection.',
      'network'
    );
  }

  if (error === 'SERVER_BAD_CONTENT' || error === 'SERVER_NO_RANGE') {
    return new DownloadError(
      'The document could not be downloaded. It may have been deleted.',
      'not_found'
    );
  }

  if (error === 'FILE_ACCESS_DENIED') {
    return new DownloadError(
      'Cannot save file. Check your download folder permissions.',
      'unknown'
    );
  }

  return new DownloadError(`Download failed: ${error}`, 'unknown');
}

/**
 * Parse document title from browser tab title
 * Removes the Google service suffix to get just the document name.
 * @param tabTitle - The browser tab title (e.g., "Q4 Budget - Google Sheets")
 * @returns The document name without the service suffix
 */
export function parseDocumentTitle(tabTitle: string): string {
  const suffixes = [
    ' - Google Sheets',
    ' - Google Docs',
    ' - Google Slides',
    ' - Google Drive',
  ];

  let title = tabTitle;
  for (const suffix of suffixes) {
    if (title.endsWith(suffix)) {
      title = title.slice(0, -suffix.length);
      break;
    }
  }

  return title.trim();
}

/**
 * Sanitize a string for use as a filename
 * Removes characters not allowed in filenames on Windows/macOS/Linux
 * @param name - The raw filename
 * @returns A filesystem-safe filename
 */
export function sanitizeFilename(name: string): string {
  // Remove characters not allowed in filenames
  // Windows: \ / : * ? " < > |
  // macOS/Linux: / and null
  let sanitized = name.replace(/[\\/:*?"<>|]/g, '');

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length (leave room for extension)
  if (sanitized.length > 200) {
    sanitized = sanitized.slice(0, 200);
  }

  return sanitized;
}

/**
 * Generate a unique filename for a downloaded document
 * Uses the document title from the tab, with document ID as fallback.
 * @param tabTitle - The browser tab title
 * @param documentId - Fallback if title is empty
 * @param fileType - The file extension/type
 * @returns A filename safe for the filesystem
 */
export function generateFilename(
  tabTitle: string,
  documentId: string,
  fileType: FileType
): string {
  const parsedTitle = parseDocumentTitle(tabTitle);
  const sanitized = sanitizeFilename(parsedTitle);

  // Use document ID as fallback if title is empty or only whitespace
  const baseName = sanitized || `${documentId.slice(0, 8)}-${Date.now()}`;

  return `open-with-${baseName}.${fileType}`;
}

/**
 * Cancel an in-progress download
 * @param downloadId - The download ID to cancel
 */
export async function cancelDownload(downloadId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.downloads.cancel(downloadId, resolve);
  });
}

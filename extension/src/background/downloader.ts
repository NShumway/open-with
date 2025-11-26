// Download manager for Chrome downloads API
// Handles file downloads with progress monitoring and error handling

import { FileType } from '../types/messages';

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
 * Generate a unique filename for a downloaded document
 * @param documentId - The document ID from the URL
 * @param fileType - The file extension/type
 * @returns A filename safe for the filesystem
 */
export function generateFilename(documentId: string, fileType: FileType): string {
  // Use a shortened document ID and timestamp for uniqueness
  const shortId = documentId.slice(0, 8);
  const timestamp = Date.now();
  return `openwith-${shortId}-${timestamp}.${fileType}`;
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

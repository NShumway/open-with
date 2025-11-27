import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadFile,
  generateFilename,
  parseDocumentTitle,
  sanitizeFilename,
  cancelDownload,
  DownloadError,
} from './downloader';

// Mock Chrome downloads API
const mockDownload = vi.fn();
const mockSearch = vi.fn();
const mockCancel = vi.fn();
const mockAddListener = vi.fn();
const mockRemoveListener = vi.fn();

// Store the listener so we can trigger events
let downloadChangeListener: ((delta: chrome.downloads.DownloadDelta) => void) | null =
  null;

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  downloadChangeListener = null;

  // Setup Chrome API mock
  mockAddListener.mockImplementation((listener) => {
    downloadChangeListener = listener;
  });

  // @ts-expect-error - Mocking global chrome object
  global.chrome = {
    downloads: {
      download: mockDownload,
      search: mockSearch,
      cancel: mockCancel,
      onChanged: {
        addListener: mockAddListener,
        removeListener: mockRemoveListener,
      },
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('downloadFile', () => {
  it('should successfully download a file', async () => {
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);
    mockSearch.mockImplementation((_query, callback) => {
      callback([{ filename: '/path/to/file.xlsx' }]);
    });

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    // Simulate download completion
    await vi.waitFor(() => expect(downloadChangeListener).not.toBeNull());
    downloadChangeListener!({
      id: downloadId,
      state: { current: 'complete', previous: 'in_progress' },
    });

    const result = await downloadPromise;

    expect(result.filePath).toBe('/path/to/file.xlsx');
    expect(result.downloadId).toBe(downloadId);
    expect(mockRemoveListener).toHaveBeenCalled();
  });

  it('should throw error when download fails to start', async () => {
    mockDownload.mockResolvedValue(undefined);

    await expect(
      downloadFile({
        url: 'https://example.com/file',
        filename: 'test.xlsx',
        fileType: 'xlsx',
      })
    ).rejects.toThrow('Failed to start download');
  });

  it('should handle download timeout', async () => {
    vi.useFakeTimers();
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    // Catch the promise early to prevent unhandled rejection warnings
    let caughtError: Error | null = null;
    downloadPromise.catch((e) => {
      caughtError = e;
    });

    // Advance timer to trigger timeout
    await vi.advanceTimersByTimeAsync(61000);

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('timed out');
    expect(mockRemoveListener).toHaveBeenCalled();
  });

  it('should handle SERVER_FORBIDDEN error', async () => {
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);
    mockSearch.mockImplementation((_query, callback) => {
      callback([{ error: 'SERVER_FORBIDDEN' }]);
    });

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    // Simulate download interruption
    await vi.waitFor(() => expect(downloadChangeListener).not.toBeNull());
    downloadChangeListener!({
      id: downloadId,
      state: { current: 'interrupted', previous: 'in_progress' },
    });

    await expect(downloadPromise).rejects.toThrow('disabled by the document owner');
  });

  it('should handle SERVER_UNAUTHORIZED error', async () => {
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);
    mockSearch.mockImplementation((_query, callback) => {
      callback([{ error: 'SERVER_UNAUTHORIZED' }]);
    });

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    await vi.waitFor(() => expect(downloadChangeListener).not.toBeNull());
    downloadChangeListener!({
      id: downloadId,
      state: { current: 'interrupted', previous: 'in_progress' },
    });

    const error = await downloadPromise.catch((e) => e);
    expect(error).toBeInstanceOf(DownloadError);
    expect(error.code).toBe('forbidden');
  });

  it('should handle network errors', async () => {
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);
    mockSearch.mockImplementation((_query, callback) => {
      callback([{ error: 'NETWORK_FAILED' }]);
    });

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    await vi.waitFor(() => expect(downloadChangeListener).not.toBeNull());
    downloadChangeListener!({
      id: downloadId,
      state: { current: 'interrupted', previous: 'in_progress' },
    });

    const error = await downloadPromise.catch((e) => e);
    expect(error).toBeInstanceOf(DownloadError);
    expect(error.code).toBe('network');
    expect(error.message).toContain('internet connection');
  });

  it('should ignore events for other downloads', async () => {
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);
    mockSearch.mockImplementation((_query, callback) => {
      callback([{ filename: '/path/to/file.xlsx' }]);
    });

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    await vi.waitFor(() => expect(downloadChangeListener).not.toBeNull());

    // Event for different download - should be ignored
    downloadChangeListener!({
      id: 999,
      state: { current: 'complete', previous: 'in_progress' },
    });

    // Verify download is still pending (not resolved yet)
    expect(mockRemoveListener).not.toHaveBeenCalled();

    // Now trigger the correct download completion
    downloadChangeListener!({
      id: downloadId,
      state: { current: 'complete', previous: 'in_progress' },
    });

    const result = await downloadPromise;
    expect(result.downloadId).toBe(downloadId);
  });

  it('should handle missing file path after completion', async () => {
    const downloadId = 123;
    mockDownload.mockResolvedValue(downloadId);
    mockSearch.mockImplementation((_query, callback) => {
      callback([]); // No results
    });

    const downloadPromise = downloadFile({
      url: 'https://example.com/file',
      filename: 'test.xlsx',
      fileType: 'xlsx',
    });

    await vi.waitFor(() => expect(downloadChangeListener).not.toBeNull());
    downloadChangeListener!({
      id: downloadId,
      state: { current: 'complete', previous: 'in_progress' },
    });

    await expect(downloadPromise).rejects.toThrow('file path not found');
  });
});

describe('parseDocumentTitle', () => {
  it('should parse Google Sheets title', () => {
    expect(parseDocumentTitle('Q4 Budget - Google Sheets')).toBe('Q4 Budget');
  });

  it('should parse Google Docs title', () => {
    expect(parseDocumentTitle('Meeting Notes - Google Docs')).toBe('Meeting Notes');
  });

  it('should parse Google Slides title', () => {
    expect(parseDocumentTitle('Sales Deck - Google Slides')).toBe('Sales Deck');
  });

  it('should parse Google Drive title', () => {
    expect(parseDocumentTitle('My File - Google Drive')).toBe('My File');
  });

  it('should return title as-is if no Google suffix', () => {
    expect(parseDocumentTitle('Some Other Page')).toBe('Some Other Page');
  });

  it('should handle empty string', () => {
    expect(parseDocumentTitle('')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(parseDocumentTitle('  Spaced Title  - Google Sheets')).toBe('Spaced Title');
  });
});

describe('sanitizeFilename', () => {
  it('should remove backslashes', () => {
    expect(sanitizeFilename('file\\name')).toBe('filename');
  });

  it('should remove forward slashes', () => {
    expect(sanitizeFilename('file/name')).toBe('filename');
  });

  it('should remove colons', () => {
    expect(sanitizeFilename('file:name')).toBe('filename');
  });

  it('should remove asterisks', () => {
    expect(sanitizeFilename('file*name')).toBe('filename');
  });

  it('should remove question marks', () => {
    expect(sanitizeFilename('file?name')).toBe('filename');
  });

  it('should remove quotes', () => {
    expect(sanitizeFilename('file"name')).toBe('filename');
  });

  it('should remove angle brackets', () => {
    expect(sanitizeFilename('file<name>')).toBe('filename');
  });

  it('should remove pipe characters', () => {
    expect(sanitizeFilename('file|name')).toBe('filename');
  });

  it('should collapse multiple spaces', () => {
    expect(sanitizeFilename('file   name')).toBe('file name');
  });

  it('should trim whitespace', () => {
    expect(sanitizeFilename('  filename  ')).toBe('filename');
  });

  it('should truncate long filenames to 200 chars', () => {
    const longName = 'a'.repeat(250);
    expect(sanitizeFilename(longName).length).toBe(200);
  });

  it('should handle combined invalid characters', () => {
    expect(sanitizeFilename('My/Bad:File*Name?')).toBe('MyBadFileName');
  });

  it('should preserve valid characters', () => {
    expect(sanitizeFilename('Valid File-Name_2024')).toBe('Valid File-Name_2024');
  });
});

describe('generateFilename', () => {
  it('should use document title when available with open-with- prefix', () => {
    const filename = generateFilename('Q4 Budget - Google Sheets', 'abc123xyz789', 'xlsx');
    expect(filename).toBe('open-with-Q4 Budget.xlsx');
  });

  it('should use correct extension for docx with open-with- prefix', () => {
    const filename = generateFilename('Meeting Notes - Google Docs', 'docid123', 'docx');
    expect(filename).toBe('open-with-Meeting Notes.docx');
  });

  it('should use correct extension for pptx with open-with- prefix', () => {
    const filename = generateFilename('Sales Deck - Google Slides', 'slideid', 'pptx');
    expect(filename).toBe('open-with-Sales Deck.pptx');
  });

  it('should fall back to document ID when title is empty', () => {
    const filename = generateFilename('', 'abc123xyz789', 'xlsx');
    expect(filename).toMatch(/^open-with-abc123xy-\d+\.xlsx$/);
  });

  it('should fall back to document ID when title has only invalid chars', () => {
    const filename = generateFilename(' - Google Sheets', 'abc123xyz789', 'xlsx');
    expect(filename).toMatch(/^open-with-abc123xy-\d+\.xlsx$/);
  });

  it('should sanitize filename with special characters', () => {
    const filename = generateFilename('My/Report:2024 - Google Sheets', 'docid', 'xlsx');
    expect(filename).toBe('open-with-MyReport2024.xlsx');
  });

  it('should handle title without Google suffix', () => {
    const filename = generateFilename('Regular Title', 'docid', 'xlsx');
    expect(filename).toBe('open-with-Regular Title.xlsx');
  });
});

describe('cancelDownload', () => {
  it('should call chrome.downloads.cancel with the download ID', async () => {
    mockCancel.mockImplementation((_id, callback) => callback());

    await cancelDownload(123);

    expect(mockCancel).toHaveBeenCalledWith(123, expect.any(Function));
  });
});

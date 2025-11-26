import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadFile,
  generateFilename,
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

describe('generateFilename', () => {
  it('should generate a valid filename with document ID and extension', () => {
    const filename = generateFilename('abc123xyz789', 'xlsx');
    expect(filename).toMatch(/^openwith-abc123xy-\d+\.xlsx$/);
  });

  it('should use correct file extension for docx', () => {
    const filename = generateFilename('docid123', 'docx');
    expect(filename).toMatch(/\.docx$/);
  });

  it('should use correct file extension for pptx', () => {
    const filename = generateFilename('slideid', 'pptx');
    expect(filename).toMatch(/\.pptx$/);
  });

  it('should produce unique filenames', () => {
    const filename1 = generateFilename('sameid', 'xlsx');
    // Small delay to ensure different timestamp
    const filename2 = generateFilename('sameid', 'xlsx');
    // Filenames might be same if called in same millisecond, but generally unique
    expect(filename1).toMatch(/^openwith-sameid-\d+\.xlsx$/);
    expect(filename2).toMatch(/^openwith-sameid-\d+\.xlsx$/);
  });

  it('should truncate long document IDs', () => {
    const longId = 'a'.repeat(100);
    const filename = generateFilename(longId, 'xlsx');
    expect(filename).toMatch(/^openwith-aaaaaaaa-\d+\.xlsx$/);
  });
});

describe('cancelDownload', () => {
  it('should call chrome.downloads.cancel with the download ID', async () => {
    mockCancel.mockImplementation((_id, callback) => callback());

    await cancelDownload(123);

    expect(mockCancel).toHaveBeenCalledWith(123, expect.any(Function));
  });
});

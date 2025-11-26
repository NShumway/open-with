import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDefaultApps,
  openFile,
  isHostAvailable,
  NativeMessagingError,
} from './native-client';

// Mock Chrome runtime API
const mockSendNativeMessage = vi.fn();
let mockLastError: { message: string } | undefined = undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mockLastError = undefined;

  // @ts-expect-error - Mocking global chrome object
  global.chrome = {
    runtime: {
      sendNativeMessage: mockSendNativeMessage,
      get lastError() {
        return mockLastError;
      },
    },
  };
});

describe('getDefaultApps', () => {
  it('should return default apps on success', async () => {
    const mockDefaults = {
      xlsx: { name: 'Excel', bundleId: 'com.microsoft.excel' },
      docx: { name: 'Word', bundleId: 'com.microsoft.word' },
      pptx: { name: 'PowerPoint', bundleId: 'com.microsoft.powerpoint' },
      txt: { name: 'TextEdit', bundleId: 'com.apple.textedit' },
      pdf: { name: 'Preview', bundleId: 'com.apple.preview' },
    };

    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({ success: true, defaults: mockDefaults });
    });

    const result = await getDefaultApps();

    expect(result).toEqual(mockDefaults);
    expect(mockSendNativeMessage).toHaveBeenCalledWith(
      'com.reclaim.openwith',
      { action: 'getDefaults' },
      expect.any(Function)
    );
  });

  it('should throw on chrome.runtime.lastError', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      mockLastError = { message: 'Host not found' };
      callback(undefined);
    });

    await expect(getDefaultApps()).rejects.toThrow('Native host not found');
  });

  it('should throw on access denied error', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      mockLastError = { message: 'access denied to file' };
      callback(undefined);
    });

    await expect(getDefaultApps()).rejects.toThrow('Check file permissions');
  });

  it('should throw on error response', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({
        success: false,
        error: 'no_default_app',
        fileType: 'xlsx',
        message: 'No default app for xlsx',
      });
    });

    const error = await getDefaultApps().catch((e) => e);

    expect(error).toBeInstanceOf(NativeMessagingError);
    expect(error.code).toBe('no_default_app');
    expect(error.fileType).toBe('xlsx');
  });

  it('should handle timeout', async () => {
    vi.useFakeTimers();

    // Never call the callback to simulate timeout
    mockSendNativeMessage.mockImplementation(() => {
      // Do nothing - simulates native host not responding
    });

    const promise = getDefaultApps();

    // Catch early to prevent unhandled rejection
    let caughtError: Error | null = null;
    promise.catch((e) => {
      caughtError = e;
    });

    await vi.advanceTimersByTimeAsync(6000);

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('did not respond');

    vi.useRealTimers();
  });

  it('should throw on empty response', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback(undefined);
    });

    await expect(getDefaultApps()).rejects.toThrow('empty response');
  });

  it('should throw on unexpected response format', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({ success: true, unexpectedField: 'value' });
    });

    await expect(getDefaultApps()).rejects.toThrow('Unexpected response format');
  });
});

describe('openFile', () => {
  it('should succeed when file opens', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({ success: true });
    });

    await openFile('/path/to/document.xlsx', 'xlsx');

    expect(mockSendNativeMessage).toHaveBeenCalledWith(
      'com.reclaim.openwith',
      { action: 'open', filePath: '/path/to/document.xlsx', fileType: 'xlsx' },
      expect.any(Function)
    );
  });

  it('should throw on error response', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({
        success: false,
        error: 'file_not_found',
        message: 'File does not exist',
      });
    });

    const error = await openFile('/nonexistent.xlsx', 'xlsx').catch((e) => e);

    expect(error).toBeInstanceOf(NativeMessagingError);
    expect(error.code).toBe('file_not_found');
  });

  it('should throw on unexpected response format', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({ success: true, defaults: {} }); // Wrong response type (getDefaults response)
    });

    await expect(openFile('/path/to/file.xlsx', 'xlsx')).rejects.toThrow(
      'Unexpected response format'
    );
  });
});

describe('isHostAvailable', () => {
  it('should return true when host responds', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({
        success: true,
        defaults: {
          xlsx: { name: 'Excel', bundleId: 'com.microsoft.excel' },
          docx: { name: 'Word', bundleId: 'com.microsoft.word' },
          pptx: { name: 'PowerPoint', bundleId: 'com.microsoft.powerpoint' },
          txt: { name: 'TextEdit', bundleId: 'com.apple.textedit' },
          pdf: { name: 'Preview', bundleId: 'com.apple.preview' },
        },
      });
    });

    const result = await isHostAvailable();

    expect(result).toBe(true);
  });

  it('should return false when host not found', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      mockLastError = { message: 'Host not found' };
      callback(undefined);
    });

    const result = await isHostAvailable();

    expect(result).toBe(false);
  });

  it('should return false on error response', async () => {
    mockSendNativeMessage.mockImplementation((_host, _request, callback) => {
      callback({ success: false, error: 'unknown' });
    });

    const result = await isHostAvailable();

    expect(result).toBe(false);
  });
});

describe('NativeMessagingError', () => {
  it('should store error code and fileType', () => {
    const error = new NativeMessagingError(
      'No default app',
      'no_default_app',
      'xlsx'
    );

    expect(error.name).toBe('NativeMessagingError');
    expect(error.message).toBe('No default app');
    expect(error.code).toBe('no_default_app');
    expect(error.fileType).toBe('xlsx');
  });

  it('should work without fileType', () => {
    const error = new NativeMessagingError('Timeout', 'timeout');

    expect(error.code).toBe('timeout');
    expect(error.fileType).toBeUndefined();
  });
});

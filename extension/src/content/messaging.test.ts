import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToContentScript, MESSAGING_TIMEOUT_MS } from './messaging';

// Mock chrome.tabs API
const mockChrome = {
  tabs: {
    sendMessage: vi.fn(),
  },
  runtime: {
    lastError: null as { message: string } | null,
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('content script messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  describe('sendToContentScript', () => {
    it('should send message to content script and return response', async () => {
      const expectedResponse = { success: true, downloadUrl: 'https://example.com/download' };
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback(expectedResponse);
      });

      const response = await sendToContentScript(123, {
        action: 'scrapeDownloadUrl',
        selectors: ['a.download'],
      });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { action: 'scrapeDownloadUrl', selectors: ['a.download'] },
        expect.any(Function)
      );
      expect(response).toEqual(expectedResponse);
    });

    it('should reject when chrome.runtime.lastError is set', async () => {
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        mockChrome.runtime.lastError = { message: 'Could not establish connection' };
        callback(undefined);
      });

      await expect(
        sendToContentScript(123, { action: 'scrapeDownloadUrl', selectors: [] })
      ).rejects.toThrow('Could not establish connection');
    });

    it('should reject when response indicates failure', async () => {
      const errorResponse = { success: false, error: 'Element not found' };
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback(errorResponse);
      });

      await expect(
        sendToContentScript(123, { action: 'scrapeDownloadUrl', selectors: [] })
      ).rejects.toThrow('Element not found');
    });

    it('should reject on timeout', async () => {
      vi.useFakeTimers();

      mockChrome.tabs.sendMessage.mockImplementation(() => {
        // Never calls callback - simulates timeout
      });

      const promise = sendToContentScript(123, {
        action: 'scrapeDownloadUrl',
        selectors: [],
      });

      vi.advanceTimersByTime(MESSAGING_TIMEOUT_MS + 100);

      await expect(promise).rejects.toThrow('timeout');

      vi.useRealTimers();
    });

    it('should handle undefined response gracefully', async () => {
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback(undefined);
      });

      await expect(
        sendToContentScript(123, { action: 'scrapeDownloadUrl', selectors: [] })
      ).rejects.toThrow();
    });
  });

  describe('timeout constant', () => {
    it('should have a reasonable timeout value', () => {
      expect(MESSAGING_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
      expect(MESSAGING_TIMEOUT_MS).toBeLessThanOrEqual(30000);
    });
  });
});

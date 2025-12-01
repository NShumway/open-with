import { describe, it, expect, vi, beforeEach } from 'vitest';
import { boxService } from './box';

// Mock chrome APIs
const mockChrome = {
  scripting: {
    executeScript: vi.fn(),
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  runtime: {
    lastError: null as { message: string } | null,
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('BoxService', () => {
  describe('detect', () => {
    describe('standard Box URLs (app.box.com/file/)', () => {
      it('should detect standard file URL', () => {
        const url = 'https://app.box.com/file/123456789012';
        const result = boxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('box');
        expect(result?.fileId).toBe('123456789012');
        expect(result?.enterpriseId).toBeUndefined();
      });

      it('should detect URL with query params', () => {
        const url = 'https://app.box.com/file/123456789012?s=abc123';
        const result = boxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('123456789012');
      });
    });

    describe('shared link URLs (app.box.com/s/)', () => {
      it('should detect shared link', () => {
        const url = 'https://app.box.com/s/abc123xyz789';
        const result = boxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('box');
        expect(result?.fileId).toBe('abc123xyz789');
      });

      it('should detect shared link with path', () => {
        const url = 'https://app.box.com/s/xyz789abc123/file/987654321';
        const result = boxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('xyz789abc123');
      });
    });

    describe('enterprise Box URLs ({domain}.app.box.com)', () => {
      it('should detect enterprise URL', () => {
        const url = 'https://acme.app.box.com/file/123456789012';
        const result = boxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('box');
        expect(result?.fileId).toBe('123456789012');
        expect(result?.enterpriseId).toBe('acme');
      });

      it('should detect multi-word enterprise domain', () => {
        const url = 'https://contoso-corp.app.box.com/file/987654321098';
        const result = boxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.enterpriseId).toBe('contoso-corp');
        expect(result?.fileId).toBe('987654321098');
      });
    });

    describe('non-matching URLs', () => {
      it('should return null for Google Docs URL', () => {
        const url = 'https://docs.google.com/spreadsheets/d/abc123/edit';
        const result = boxService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for Dropbox URL', () => {
        const url = 'https://www.dropbox.com/s/abc123/file.xlsx';
        const result = boxService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for Box marketing pages', () => {
        const url = 'https://www.box.com/features';
        const result = boxService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for app.box.com without file path', () => {
        const url = 'https://app.box.com/folder/12345';
        const result = boxService.detect(url);
        expect(result).toBeNull();
      });
    });
  });

  describe('getDownloadUrl', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockChrome.runtime.lastError = null;
    });

    it('should throw error when tab is not provided', async () => {
      const info = boxService.detect('https://app.box.com/file/123456789012')!;
      await expect(boxService.getDownloadUrl(info)).rejects.toThrow('Tab required');
    });

    it('should use DOM scraping when successful', async () => {
      const mockTab = { id: 123 } as chrome.tabs.Tab;
      const info = boxService.detect('https://app.box.com/file/123456789012')!;

      mockChrome.scripting.executeScript.mockResolvedValue([{ result: true }]);
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback({ success: true, downloadUrl: 'https://app.box.com/download/123' });
      });

      const downloadUrl = await boxService.getDownloadUrl(info, mockTab);
      expect(downloadUrl).toBe('https://app.box.com/download/123');
    });

    it('should fall back to API endpoint when scraping fails', async () => {
      const mockTab = { id: 456 } as chrome.tabs.Tab;
      const info = boxService.detect('https://app.box.com/file/123456789012')!;

      mockChrome.scripting.executeScript.mockResolvedValue([{ result: true }]);
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback({ success: false, error: 'Element not found' });
      });

      const downloadUrl = await boxService.getDownloadUrl(info, mockTab);
      expect(downloadUrl).toBe('https://app.box.com/index.php?rm=box_download_file&file_id=123456789012');
    });

    it('should use enterprise domain in fallback URL', async () => {
      const mockTab = { id: 789 } as chrome.tabs.Tab;
      const info = boxService.detect('https://acme.app.box.com/file/123456789012')!;

      mockChrome.scripting.executeScript.mockResolvedValue([{ result: true }]);
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback({ success: false });
      });

      const downloadUrl = await boxService.getDownloadUrl(info, mockTab);
      expect(downloadUrl).toBe('https://acme.app.box.com/index.php?rm=box_download_file&file_id=123456789012');
    });

    it('should inject content script before sending message', async () => {
      const mockTab = { id: 111 } as chrome.tabs.Tab;
      const info = boxService.detect('https://app.box.com/file/123456789012')!;

      mockChrome.scripting.executeScript.mockResolvedValue([{ result: true }]);
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
        callback({ success: true, downloadUrl: 'https://example.com/download' });
      });

      await boxService.getDownloadUrl(info, mockTab);

      expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 111 },
        files: ['dist/content/scraper.js'],
      });
    });
  });

  describe('parseTitle', () => {
    it('should remove " - Box" suffix', () => {
      const title = 'Budget 2024.xlsx - Box';
      const result = boxService.parseTitle(title);
      expect(result).toBe('Budget 2024.xlsx');
    });

    it('should remove " | Box" suffix', () => {
      const title = 'Report.docx | Box';
      const result = boxService.parseTitle(title);
      expect(result).toBe('Report.docx');
    });

    it('should return title unchanged if no known suffix', () => {
      const title = 'Some Document';
      const result = boxService.parseTitle(title);
      expect(result).toBe('Some Document');
    });

    it('should trim whitespace', () => {
      const title = '  Document Name  - Box';
      const result = boxService.parseTitle(title);
      expect(result).toBe('Document Name');
    });
  });

  describe('file type detection', () => {
    it('should default to pdf for all Box files', () => {
      const result = boxService.detect('https://app.box.com/file/123456789012');
      expect(result?.fileType).toBe('pdf');
    });
  });
});

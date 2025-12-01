import { describe, it, expect } from 'vitest';
import { dropboxService } from './dropbox';

describe('DropboxService', () => {
  describe('detect', () => {
    describe('shared link URLs (dropbox.com/s/)', () => {
      it('should detect shared link with filename', () => {
        const url = 'https://www.dropbox.com/s/abc123xyz789/document.xlsx';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('dropbox');
        expect(result?.fileId).toBe('abc123xyz789');
        expect(result?.isSharedLink).toBe(true);
        expect(result?.fileType).toBe('xlsx');
      });

      it('should detect shared link with query params', () => {
        const url = 'https://www.dropbox.com/s/abc123xyz789/report.docx?dl=0';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('abc123xyz789');
        expect(result?.fileType).toBe('docx');
      });

      it('should decode URL-encoded filename', () => {
        const url = 'https://www.dropbox.com/s/abc123xyz789/My%20Document.pdf';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileType).toBe('pdf');
      });
    });

    describe('shared link v2 URLs (dropbox.com/scl/fi/)', () => {
      it('should detect scl/fi shared link', () => {
        const url = 'https://www.dropbox.com/scl/fi/xyz789abc123/spreadsheet.xlsx';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('dropbox');
        expect(result?.fileId).toBe('xyz789abc123');
        expect(result?.isSharedLink).toBe(true);
        expect(result?.fileType).toBe('xlsx');
      });

      it('should detect scl/fi link with query params', () => {
        const url = 'https://www.dropbox.com/scl/fi/abc123/presentation.pptx?rlkey=abc&dl=0';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('abc123');
        expect(result?.fileType).toBe('pptx');
      });
    });

    describe('home URLs (dropbox.com/home/)', () => {
      it('should detect home path URL', () => {
        const url = 'https://www.dropbox.com/home/Documents/report.xlsx';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('dropbox');
        expect(result?.isSharedLink).toBe(false);
        expect(result?.fileType).toBe('xlsx');
      });
    });

    describe('preview URLs (dropbox.com/preview/)', () => {
      it('should detect preview URL with filename', () => {
        const url = 'https://www.dropbox.com/preview/Resume.docx?context=content_suggestions&role=personal';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('dropbox');
        expect(result?.fileId).toBe('Resume.docx');
        expect(result?.isSharedLink).toBe(false);
        expect(result?.fileType).toBe('docx');
      });

      it('should detect preview URL with nested path', () => {
        const url = 'https://www.dropbox.com/preview/Documents/Reports/Q4-Budget.xlsx';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('dropbox');
        expect(result?.isSharedLink).toBe(false);
        expect(result?.fileType).toBe('xlsx');
      });

      it('should handle URL-encoded preview paths', () => {
        const url = 'https://www.dropbox.com/preview/My%20Documents/Report%202024.pdf';
        const result = dropboxService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileType).toBe('pdf');
      });
    });

    describe('non-matching URLs', () => {
      it('should return null for Google Docs URL', () => {
        const url = 'https://docs.google.com/spreadsheets/d/abc123/edit';
        const result = dropboxService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for random URL', () => {
        const url = 'https://example.com/some/path';
        const result = dropboxService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for Dropbox marketing pages', () => {
        const url = 'https://www.dropbox.com/features';
        const result = dropboxService.detect(url);
        expect(result).toBeNull();
      });
    });
  });

  describe('getDownloadUrl', () => {
    it('should append ?dl=1 to shared link', async () => {
      const info = dropboxService.detect('https://www.dropbox.com/s/abc123xyz789/file.xlsx')!;
      const downloadUrl = await dropboxService.getDownloadUrl(info);
      expect(downloadUrl).toBe('https://www.dropbox.com/s/abc123xyz789/file.xlsx?dl=1');
    });

    it('should replace existing query params with ?dl=1', async () => {
      const info = dropboxService.detect('https://www.dropbox.com/s/abc123xyz789/file.xlsx?dl=0&other=value')!;
      const downloadUrl = await dropboxService.getDownloadUrl(info);
      expect(downloadUrl).toBe('https://www.dropbox.com/s/abc123xyz789/file.xlsx?dl=1');
    });

    it('should work with scl/fi URLs', async () => {
      const info = dropboxService.detect('https://www.dropbox.com/scl/fi/abc123/file.docx')!;
      const downloadUrl = await dropboxService.getDownloadUrl(info);
      expect(downloadUrl).toBe('https://www.dropbox.com/scl/fi/abc123/file.docx?dl=1');
    });
  });

  describe('parseTitle', () => {
    it('should remove " - Dropbox" suffix', () => {
      const title = 'Budget 2024.xlsx - Dropbox';
      const result = dropboxService.parseTitle(title);
      expect(result).toBe('Budget 2024.xlsx');
    });

    it('should remove " | Dropbox" suffix', () => {
      const title = 'Report.docx | Dropbox';
      const result = dropboxService.parseTitle(title);
      expect(result).toBe('Report.docx');
    });

    it('should return title unchanged if no known suffix', () => {
      const title = 'Some Document';
      const result = dropboxService.parseTitle(title);
      expect(result).toBe('Some Document');
    });

    it('should trim whitespace', () => {
      const title = '  Document Name  - Dropbox';
      const result = dropboxService.parseTitle(title);
      expect(result).toBe('Document Name');
    });
  });

  describe('file type extraction', () => {
    it('should detect xlsx files', () => {
      const result = dropboxService.detect('https://www.dropbox.com/s/abc123/file.xlsx');
      expect(result?.fileType).toBe('xlsx');
    });

    it('should detect docx files', () => {
      const result = dropboxService.detect('https://www.dropbox.com/s/abc123/file.docx');
      expect(result?.fileType).toBe('docx');
    });

    it('should detect pptx files', () => {
      const result = dropboxService.detect('https://www.dropbox.com/s/abc123/file.pptx');
      expect(result?.fileType).toBe('pptx');
    });

    it('should detect pdf files', () => {
      const result = dropboxService.detect('https://www.dropbox.com/s/abc123/file.pdf');
      expect(result?.fileType).toBe('pdf');
    });

    it('should default to txt for unknown extensions', () => {
      const result = dropboxService.detect('https://www.dropbox.com/s/abc123/file.unknown');
      expect(result?.fileType).toBe('txt');
    });
  });
});

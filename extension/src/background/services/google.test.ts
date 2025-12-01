import { describe, it, expect } from 'vitest';
import { googleService } from './google';

describe('GoogleService', () => {
  describe('detect', () => {
    describe('Google Sheets URLs', () => {
      it('should detect Google Sheets URL', () => {
        const url = 'https://docs.google.com/spreadsheets/d/1abc123-_xyz/edit';
        const result = googleService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('google');
        expect(result?.fileType).toBe('xlsx');
        expect(result?.fileId).toBe('1abc123-_xyz');
      });

      it('should detect Workspace account URL (/u/0/d/)', () => {
        const url = 'https://docs.google.com/spreadsheets/u/0/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit';
        const result = googleService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz');
      });

      it('should detect URL with query params', () => {
        const url = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing&ouid=123';
        const result = googleService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz');
      });

      it('should detect URL with fragments', () => {
        const url = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=0';
        const result = googleService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz');
      });

      it('should build correct export URL', () => {
        const url = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit';
        const result = googleService.detect(url);
        expect(result?.exportUrl).toBe(
          'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=xlsx'
        );
      });
    });

    describe('Google Docs URLs', () => {
      it('should detect Google Docs URL', () => {
        const url = 'https://docs.google.com/document/d/1abc123-_xyz/edit';
        const result = googleService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('google');
        expect(result?.fileType).toBe('docx');
      });

      it('should build correct export URL for Docs', () => {
        const url = 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit';
        const result = googleService.detect(url);
        expect(result?.exportUrl).toBe(
          'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=docx'
        );
      });
    });

    describe('Google Slides URLs', () => {
      it('should detect Google Slides URL', () => {
        const url = 'https://docs.google.com/presentation/d/1abc123-_xyz/edit';
        const result = googleService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('google');
        expect(result?.fileType).toBe('pptx');
      });

      it('should build correct export URL for Slides', () => {
        const url = 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit';
        const result = googleService.detect(url);
        expect(result?.exportUrl).toBe(
          'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=pptx'
        );
      });
    });

    describe('non-matching URLs', () => {
      it('should return null for non-Google URLs', () => {
        const url = 'https://example.com/document/d/123';
        const result = googleService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for Google Forms', () => {
        const url = 'https://docs.google.com/forms/d/123';
        const result = googleService.detect(url);
        expect(result).toBeNull();
      });

    });
  });

  describe('getDownloadUrl', () => {
    it('should return export URL from file info', async () => {
      const info = googleService.detect('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit')!;
      const downloadUrl = await googleService.getDownloadUrl(info);
      expect(downloadUrl).toBe(info.exportUrl);
    });
  });

  describe('parseTitle', () => {
    it('should remove " - Google Sheets" suffix', () => {
      const title = 'Budget 2024 - Google Sheets';
      const result = googleService.parseTitle(title);
      expect(result).toBe('Budget 2024');
    });

    it('should remove " - Google Docs" suffix', () => {
      const title = 'Project Plan - Google Docs';
      const result = googleService.parseTitle(title);
      expect(result).toBe('Project Plan');
    });

    it('should remove " - Google Slides" suffix', () => {
      const title = 'Presentation - Google Slides';
      const result = googleService.parseTitle(title);
      expect(result).toBe('Presentation');
    });

    it('should return title unchanged if no known suffix', () => {
      const title = 'Some Document';
      const result = googleService.parseTitle(title);
      expect(result).toBe('Some Document');
    });

    it('should trim whitespace', () => {
      const title = '  Document Name  - Google Sheets';
      const result = googleService.parseTitle(title);
      expect(result).toBe('Document Name');
    });
  });
});

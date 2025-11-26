import { describe, it, expect } from 'vitest';
import {
  getSiteConfig,
  extractDocumentId,
  buildExportUrl,
  getAllUrlPatterns,
  parseDocumentUrl,
  SITE_CONFIGS,
} from './site-registry';

describe('site-registry', () => {
  describe('getSiteConfig', () => {
    it('should match Google Sheets URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1abc123-_xyz/edit';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Sheets');
      expect(config?.fileType).toBe('xlsx');
    });

    it('should match Google Docs URL', () => {
      const url = 'https://docs.google.com/document/d/1abc123-_xyz/edit';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Docs');
      expect(config?.fileType).toBe('docx');
    });

    it('should match Google Slides URL', () => {
      const url = 'https://docs.google.com/presentation/d/1abc123-_xyz/edit';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Slides');
      expect(config?.fileType).toBe('pptx');
    });

    it('should match URLs with query params', () => {
      const url =
        'https://docs.google.com/spreadsheets/d/1abc123/edit?usp=sharing&ouid=123';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Sheets');
    });

    it('should match URLs with fragments', () => {
      const url =
        'https://docs.google.com/spreadsheets/d/1abc123/edit#gid=0';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Sheets');
    });

    it('should match Google Workspace account URLs (/u/0/d/)', () => {
      const url = 'https://docs.google.com/spreadsheets/u/0/d/1abc123/edit';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Sheets');
    });

    it('should match Google Workspace URLs with different account numbers', () => {
      const url = 'https://docs.google.com/document/u/1/d/1abc123/edit';
      const config = getSiteConfig(url);
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Google Docs');
    });

    it('should return null for non-Google URLs', () => {
      const url = 'https://example.com/document/d/123';
      const config = getSiteConfig(url);
      expect(config).toBeNull();
    });

    it('should return null for Google URLs without document ID pattern', () => {
      const url = 'https://docs.google.com/forms/d/123';
      const config = getSiteConfig(url);
      expect(config).toBeNull();
    });
  });

  describe('extractDocumentId', () => {
    it('should extract ID from Sheets URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit';
      const config = getSiteConfig(url)!;
      const id = extractDocumentId(url, config);
      expect(id).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz');
    });

    it('should extract ID from Docs URL', () => {
      const url = 'https://docs.google.com/document/d/doc-id_with-special123/edit';
      const config = getSiteConfig(url)!;
      const id = extractDocumentId(url, config);
      expect(id).toBe('doc-id_with-special123');
    });

    it('should extract ID from Workspace account URL', () => {
      const url = 'https://docs.google.com/presentation/u/2/d/slide_id123/edit';
      const config = getSiteConfig(url)!;
      const id = extractDocumentId(url, config);
      expect(id).toBe('slide_id123');
    });

    it('should extract ID regardless of query params', () => {
      const url =
        'https://docs.google.com/spreadsheets/d/myDocId123/edit?usp=sharing';
      const config = getSiteConfig(url)!;
      const id = extractDocumentId(url, config);
      expect(id).toBe('myDocId123');
    });

    it('should extract ID regardless of fragment', () => {
      const url =
        'https://docs.google.com/spreadsheets/d/myDocId123/edit#gid=456';
      const config = getSiteConfig(url)!;
      const id = extractDocumentId(url, config);
      expect(id).toBe('myDocId123');
    });
  });

  describe('buildExportUrl', () => {
    it('should build correct export URL for Sheets', () => {
      const config = SITE_CONFIGS.find((c) => c.name === 'Google Sheets')!;
      const exportUrl = buildExportUrl(config, 'abc123');
      expect(exportUrl).toBe(
        'https://docs.google.com/spreadsheets/d/abc123/export?format=xlsx'
      );
    });

    it('should build correct export URL for Docs', () => {
      const config = SITE_CONFIGS.find((c) => c.name === 'Google Docs')!;
      const exportUrl = buildExportUrl(config, 'doc456');
      expect(exportUrl).toBe(
        'https://docs.google.com/document/d/doc456/export?format=docx'
      );
    });

    it('should build correct export URL for Slides', () => {
      const config = SITE_CONFIGS.find((c) => c.name === 'Google Slides')!;
      const exportUrl = buildExportUrl(config, 'slide789');
      expect(exportUrl).toBe(
        'https://docs.google.com/presentation/d/slide789/export?format=pptx'
      );
    });
  });

  describe('getAllUrlPatterns', () => {
    it('should return all URL patterns from all configs', () => {
      const patterns = getAllUrlPatterns();
      expect(patterns).toContain('https://docs.google.com/spreadsheets/d/*');
      expect(patterns).toContain('https://docs.google.com/spreadsheets/u/*/d/*');
      expect(patterns).toContain('https://docs.google.com/document/d/*');
      expect(patterns).toContain('https://docs.google.com/document/u/*/d/*');
      expect(patterns).toContain('https://docs.google.com/presentation/d/*');
      expect(patterns).toContain('https://docs.google.com/presentation/u/*/d/*');
    });

    it('should return correct number of patterns', () => {
      const patterns = getAllUrlPatterns();
      // 3 services * 2 patterns each = 6 patterns
      expect(patterns).toHaveLength(6);
    });
  });

  describe('parseDocumentUrl', () => {
    it('should return full parse result for valid Sheets URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/testDoc123/edit';
      const result = parseDocumentUrl(url);
      expect(result).not.toBeNull();
      expect(result?.config.name).toBe('Google Sheets');
      expect(result?.documentId).toBe('testDoc123');
      expect(result?.exportUrl).toBe(
        'https://docs.google.com/spreadsheets/d/testDoc123/export?format=xlsx'
      );
    });

    it('should return null for unsupported URL', () => {
      const url = 'https://example.com/doc';
      const result = parseDocumentUrl(url);
      expect(result).toBeNull();
    });

    it('should handle Workspace account URLs', () => {
      const url = 'https://docs.google.com/document/u/0/d/workspaceDoc456/edit';
      const result = parseDocumentUrl(url);
      expect(result).not.toBeNull();
      expect(result?.config.name).toBe('Google Docs');
      expect(result?.documentId).toBe('workspaceDoc456');
    });
  });
});

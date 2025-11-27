// Tests for popup utility functions
import { describe, it, expect } from 'vitest';
import { parseDocumentTitle } from './title-parser';
import { SiteConfig } from '../background/site-registry';

// Mock SiteConfig for testing
const mockSheetsConfig: SiteConfig = {
  name: 'Google Sheets',
  urlPatterns: ['https://docs.google.com/spreadsheets/d/*'],
  documentIdRegex: /^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
  exportUrl: (id: string) => `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
  fileType: 'xlsx',
};

const mockDocsConfig: SiteConfig = {
  name: 'Google Docs',
  urlPatterns: ['https://docs.google.com/document/d/*'],
  documentIdRegex: /^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
  exportUrl: (id: string) => `https://docs.google.com/document/d/${id}/export?format=docx`,
  fileType: 'docx',
};

const mockSlidesConfig: SiteConfig = {
  name: 'Google Slides',
  urlPatterns: ['https://docs.google.com/presentation/d/*'],
  documentIdRegex: /^https:\/\/docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
  exportUrl: (id: string) => `https://docs.google.com/presentation/d/${id}/export?format=pptx`,
  fileType: 'pptx',
};

describe('parseDocumentTitle', () => {
  describe('basic title extraction', () => {
    it('extracts title from Google Sheets tab title', () => {
      const result = parseDocumentTitle('Q4 Budget - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Q4 Budget');
    });

    it('extracts title from Google Docs tab title', () => {
      const result = parseDocumentTitle('Meeting Notes - Google Docs', mockDocsConfig);
      expect(result).toBe('Meeting Notes');
    });

    it('extracts title from Google Slides tab title', () => {
      const result = parseDocumentTitle('Presentation - Google Slides', mockSlidesConfig);
      expect(result).toBe('Presentation');
    });
  });

  describe('title with multiple hyphens', () => {
    it('handles title with embedded hyphens', () => {
      const result = parseDocumentTitle('Q1-2024-Budget-Report - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Q1-2024-Budget-Report');
    });

    it('handles title with multiple dashes', () => {
      const result = parseDocumentTitle('Project Plan -- Draft - Google Docs', mockDocsConfig);
      expect(result).toBe('Project Plan -- Draft');
    });
  });

  describe('filename sanitization', () => {
    it('removes forward slashes', () => {
      const result = parseDocumentTitle('Report 2024/Q4 - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Report 2024Q4');
    });

    it('removes backslashes', () => {
      const result = parseDocumentTitle('File\\Name\\Test - Google Docs', mockDocsConfig);
      expect(result).toBe('FileNameTest');
    });

    it('removes colons', () => {
      const result = parseDocumentTitle('Meeting: 10:00 AM - Google Docs', mockDocsConfig);
      expect(result).toBe('Meeting 1000 AM');
    });

    it('removes asterisks', () => {
      const result = parseDocumentTitle('Important* Notes - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Important Notes');
    });

    it('removes question marks', () => {
      const result = parseDocumentTitle('What is this? - Google Docs', mockDocsConfig);
      expect(result).toBe('What is this');
    });

    it('removes double quotes', () => {
      const result = parseDocumentTitle('"Quoted Title" - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Quoted Title');
    });

    it('removes angle brackets', () => {
      const result = parseDocumentTitle('<Draft> Document - Google Docs', mockDocsConfig);
      expect(result).toBe('Draft Document');
    });

    it('removes pipe characters', () => {
      const result = parseDocumentTitle('Option A | Option B - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Option A  Option B');
    });

    it('removes multiple unsafe characters', () => {
      const result = parseDocumentTitle('File/Name:Test*? - Google Docs', mockDocsConfig);
      expect(result).toBe('FileNameTest');
    });
  });

  describe('whitespace handling', () => {
    it('trims leading whitespace', () => {
      const result = parseDocumentTitle('  Untitled - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Untitled');
    });

    it('trims trailing whitespace', () => {
      const result = parseDocumentTitle('Untitled   - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Untitled');
    });
  });

  describe('empty and edge cases', () => {
    it('returns empty string for title with only unsafe characters', () => {
      const result = parseDocumentTitle('/**:? - Google Sheets', mockSheetsConfig);
      expect(result).toBe('');
    });

    it('returns empty string for title that becomes empty after sanitization', () => {
      const result = parseDocumentTitle('<>:"/\\|?* - Google Docs', mockDocsConfig);
      expect(result).toBe('');
    });

    it('handles title without Google suffix gracefully', () => {
      const result = parseDocumentTitle('Plain Title', mockSheetsConfig);
      expect(result).toBe('Plain Title');
    });

    it('handles empty string input', () => {
      const result = parseDocumentTitle('', mockSheetsConfig);
      expect(result).toBe('');
    });
  });

  describe('special document titles', () => {
    it('handles Untitled document', () => {
      const result = parseDocumentTitle('Untitled spreadsheet - Google Sheets', mockSheetsConfig);
      expect(result).toBe('Untitled spreadsheet');
    });

    it('handles document with emojis', () => {
      const result = parseDocumentTitle('Team Notes 📝 - Google Docs', mockDocsConfig);
      expect(result).toBe('Team Notes 📝');
    });

    it('handles document with unicode characters', () => {
      const result = parseDocumentTitle('Café Menu - Google Docs', mockDocsConfig);
      expect(result).toBe('Café Menu');
    });
  });
});

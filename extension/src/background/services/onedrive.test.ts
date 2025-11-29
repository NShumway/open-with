import { describe, it, expect } from 'vitest';
import { oneDriveService } from './onedrive';

describe('OneDriveService', () => {
  describe('detect', () => {
    describe('personal OneDrive URLs (onedrive.live.com)', () => {
      it('should detect edit.aspx URL with resid', () => {
        const url = 'https://onedrive.live.com/edit.aspx?resid=ABC123DEF456&cid=789';
        const result = oneDriveService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('onedrive');
        expect(result?.fileId).toBe('ABC123DEF456');
        expect(result?.isSharePoint).toBe(false);
      });

      it('should detect view.aspx URL with resid', () => {
        const url = 'https://onedrive.live.com/view.aspx?resid=XYZ789&otherparam=value';
        const result = oneDriveService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('XYZ789');
        expect(result?.isSharePoint).toBe(false);
      });

      it('should detect file type from URL containing Excel', () => {
        const url = 'https://onedrive.live.com/edit.aspx?resid=ABC123&app=Excel';
        const result = oneDriveService.detect(url);
        expect(result?.fileType).toBe('xlsx');
      });

      it('should detect file type from URL containing Word', () => {
        const url = 'https://onedrive.live.com/edit.aspx?resid=ABC123&app=Word';
        const result = oneDriveService.detect(url);
        expect(result?.fileType).toBe('docx');
      });

      it('should detect file type from URL containing PowerPoint', () => {
        const url = 'https://onedrive.live.com/edit.aspx?resid=ABC123&app=PowerPoint';
        const result = oneDriveService.detect(url);
        expect(result?.fileType).toBe('pptx');
      });

      it('should default to pdf for unknown file types', () => {
        const url = 'https://onedrive.live.com/edit.aspx?resid=ABC123';
        const result = oneDriveService.detect(url);
        expect(result?.fileType).toBe('pdf');
      });
    });

    describe('SharePoint URLs (*.sharepoint.com)', () => {
      it('should detect SharePoint URL with :x: prefix (Excel)', () => {
        const url = 'https://contoso.sharepoint.com/:x:/r/sites/team/Shared%20Documents/Budget.xlsx';
        const result = oneDriveService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.service).toBe('onedrive');
        expect(result?.isSharePoint).toBe(true);
        expect(result?.fileType).toBe('xlsx');
      });

      it('should detect SharePoint URL with :w: prefix (Word)', () => {
        const url = 'https://mycompany.sharepoint.com/:w:/s/project/Document.docx';
        const result = oneDriveService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.isSharePoint).toBe(true);
        expect(result?.fileType).toBe('docx');
      });

      it('should detect SharePoint URL with :p: prefix (PowerPoint)', () => {
        const url = 'https://acme.sharepoint.com/:p:/g/personal/user/Presentation.pptx';
        const result = oneDriveService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.isSharePoint).toBe(true);
        expect(result?.fileType).toBe('pptx');
      });

      it('should detect SharePoint _layouts/15/Doc.aspx URL', () => {
        const url = 'https://contoso.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc=ABC123&action=edit';
        const result = oneDriveService.detect(url);
        expect(result).not.toBeNull();
        expect(result?.isSharePoint).toBe(true);
        expect(result?.fileId).toBe('ABC123');
        expect(result?.driveId).toBe('contoso');
      });
    });

    describe('non-matching URLs', () => {
      it('should return null for Google Docs URL', () => {
        const url = 'https://docs.google.com/spreadsheets/d/abc123/edit';
        const result = oneDriveService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for Dropbox URL', () => {
        const url = 'https://www.dropbox.com/s/abc123/file.xlsx';
        const result = oneDriveService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for random URL', () => {
        const url = 'https://example.com/some/path';
        const result = oneDriveService.detect(url);
        expect(result).toBeNull();
      });

      it('should return null for OneDrive URL without resid', () => {
        const url = 'https://onedrive.live.com/about/';
        const result = oneDriveService.detect(url);
        expect(result).toBeNull();
      });
    });
  });

  describe('getDownloadUrl', () => {
    describe('URL transformation strategy', () => {
      it('should transform edit.aspx to download.aspx', async () => {
        const info = oneDriveService.detect('https://onedrive.live.com/edit.aspx?resid=ABC123&app=Excel')!;
        const downloadUrl = await oneDriveService.getDownloadUrl(info);
        expect(downloadUrl).toBe('https://onedrive.live.com/download.aspx?resid=ABC123&app=Excel');
      });

      it('should transform view.aspx to download.aspx', async () => {
        const info = oneDriveService.detect('https://onedrive.live.com/view.aspx?resid=XYZ789&cid=123')!;
        const downloadUrl = await oneDriveService.getDownloadUrl(info);
        expect(downloadUrl).toBe('https://onedrive.live.com/download.aspx?resid=XYZ789&cid=123');
      });

      it('should preserve all query parameters during transformation', async () => {
        const info = oneDriveService.detect('https://onedrive.live.com/edit.aspx?resid=ABC&cid=123&app=Excel&other=value')!;
        const downloadUrl = await oneDriveService.getDownloadUrl(info);
        expect(downloadUrl).toContain('resid=ABC');
        expect(downloadUrl).toContain('cid=123');
        expect(downloadUrl).toContain('app=Excel');
        expect(downloadUrl).toContain('other=value');
      });
    });

    describe('URLs requiring DOM scraping', () => {
      it('should throw error for SharePoint URLs without tab', async () => {
        const info = oneDriveService.detect('https://contoso.sharepoint.com/:x:/r/sites/team/Budget.xlsx')!;
        await expect(oneDriveService.getDownloadUrl(info)).rejects.toThrow();
      });
    });
  });

  describe('parseTitle', () => {
    it('should remove " - OneDrive" suffix', () => {
      const title = 'Budget 2024.xlsx - OneDrive';
      const result = oneDriveService.parseTitle(title);
      expect(result).toBe('Budget 2024.xlsx');
    });

    it('should remove " - SharePoint" suffix', () => {
      const title = 'Project Plan.docx - SharePoint';
      const result = oneDriveService.parseTitle(title);
      expect(result).toBe('Project Plan.docx');
    });

    it('should return title unchanged if no known suffix', () => {
      const title = 'Some Document';
      const result = oneDriveService.parseTitle(title);
      expect(result).toBe('Some Document');
    });

    it('should trim whitespace', () => {
      const title = '  Document Name  - OneDrive';
      const result = oneDriveService.parseTitle(title);
      expect(result).toBe('Document Name');
    });
  });
});

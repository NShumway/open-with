// Google Workspace service handler
// Handles URL detection and download URL construction for Google Sheets, Docs, Slides

import { GoogleFileInfo, ServiceHandler } from '../../types/services';
import { FileType } from '../../types/messages';

interface GoogleSiteConfig {
  name: string;
  documentIdRegex: RegExp;
  exportUrl: (id: string) => string;
  fileType: FileType;
}

// Google-specific configs (standalone to avoid circular dependency with site-registry)
const GOOGLE_CONFIGS: GoogleSiteConfig[] = [
  {
    name: 'Google Sheets',
    documentIdRegex:
      /^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
    exportUrl: (id: string) =>
      `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    fileType: 'xlsx',
  },
  {
    name: 'Google Docs',
    documentIdRegex:
      /^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
    exportUrl: (id: string) =>
      `https://docs.google.com/document/d/${id}/export?format=docx`,
    fileType: 'docx',
  },
  {
    name: 'Google Slides',
    documentIdRegex:
      /^https:\/\/docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
    exportUrl: (id: string) =>
      `https://docs.google.com/presentation/d/${id}/export?format=pptx`,
    fileType: 'pptx',
  },
];

class GoogleService implements ServiceHandler<GoogleFileInfo> {
  readonly name = 'Google Workspace';
  readonly type = 'google' as const;

  detect(url: string): GoogleFileInfo | null {
    for (const config of GOOGLE_CONFIGS) {
      const match = url.match(config.documentIdRegex);
      if (match && match[1]) {
        const documentId = match[1];

        // Validate document ID
        if (!this.isValidDocumentId(documentId)) {
          return null;
        }

        return {
          service: 'google',
          fileId: documentId,
          fileType: config.fileType,
          url,
          exportUrl: config.exportUrl(documentId),
        };
      }
    }
    return null;
  }

  async getDownloadUrl(info: GoogleFileInfo): Promise<string> {
    return info.exportUrl;
  }

  parseTitle(tabTitle: string): string {
    const suffixes = [' - Google Sheets', ' - Google Docs', ' - Google Slides'];
    let title = tabTitle;
    for (const suffix of suffixes) {
      if (title.endsWith(suffix)) {
        title = title.slice(0, -suffix.length);
        break;
      }
    }
    return title.trim();
  }

  private isValidDocumentId(documentId: string): boolean {
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (documentId.length < 10 || documentId.length > 100) {
      return false;
    }
    return validPattern.test(documentId);
  }
}

export const googleService = new GoogleService();

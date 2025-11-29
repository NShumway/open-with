// Dropbox service handler
// Handles URL detection and download URL construction for Dropbox shared links

import { DropboxFileInfo, ServiceHandler } from '../../types/services';
import { FileType } from '../../types/messages';

class DropboxService implements ServiceHandler<DropboxFileInfo> {
  readonly name = 'Dropbox';
  readonly type = 'dropbox' as const;

  private urlPatterns = [
    // Shared link: dropbox.com/s/{id}/{filename}
    /^https:\/\/www\.dropbox\.com\/s\/([a-zA-Z0-9]+)\/([^?]+)/,
    // Shared link v2: dropbox.com/scl/fi/{id}/{filename}
    /^https:\/\/www\.dropbox\.com\/scl\/fi\/([a-zA-Z0-9]+)\/([^?]+)/,
    // File viewer: dropbox.com/home/{path}
    /^https:\/\/www\.dropbox\.com\/home\/(.+)/,
  ];

  detect(url: string): DropboxFileInfo | null {
    for (let i = 0; i < this.urlPatterns.length; i++) {
      const pattern = this.urlPatterns[i];
      const match = url.match(pattern);
      if (match) {
        const fileId = match[1];
        const filename = match[2] ? decodeURIComponent(match[2]) : undefined;
        // Home URLs are not shared links
        const isSharedLink = i < 2;

        return {
          service: 'dropbox',
          fileId,
          isSharedLink,
          fileType: this.extractFileType(filename),
          url,
        };
      }
    }
    return null;
  }

  async getDownloadUrl(info: DropboxFileInfo): Promise<string> {
    // Append ?dl=1 to force download
    const baseUrl = info.url.split('?')[0];
    return `${baseUrl}?dl=1`;
  }

  parseTitle(tabTitle: string): string {
    const suffixes = [' - Dropbox', ' | Dropbox'];
    let title = tabTitle;
    for (const suffix of suffixes) {
      if (title.endsWith(suffix)) {
        title = title.slice(0, -suffix.length);
        break;
      }
    }
    return title.trim();
  }

  private extractFileType(filename?: string): FileType {
    if (!filename) return 'pdf';

    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'xlsx':
        return 'xlsx';
      case 'docx':
        return 'docx';
      case 'pptx':
        return 'pptx';
      case 'pdf':
        return 'pdf';
      default:
        return 'txt';
    }
  }
}

export const dropboxService = new DropboxService();

// OneDrive/SharePoint service handler
// Handles URL detection and download URL discovery for OneDrive personal and SharePoint

import { FileType } from '../../types/messages';
import { OneDriveFileInfo, ServiceHandler } from '../../types/services';

class OneDriveService implements ServiceHandler<OneDriveFileInfo> {
  readonly name = 'OneDrive';
  readonly type = 'onedrive' as const;

  private patterns = {
    // OneDrive personal: onedrive.live.com/edit.aspx?resid=...
    personal: /^https:\/\/onedrive\.live\.com\/(edit|view)\.aspx\?.*resid=([^&]+)/,
    // SharePoint: *.sharepoint.com/:x:/ or /:w:/ or /:p:/
    sharepoint: /^https:\/\/([^.]+)\.sharepoint\.com\/:([xwp]):\/(.+)/,
    // SharePoint layouts: _layouts/15/Doc.aspx?sourcedoc=...
    sharepointLayouts: /^https:\/\/([^.]+)\.sharepoint\.com\/_layouts\/15\/Doc\.aspx\?.*sourcedoc=([^&]+)/,
  };

  detect(url: string): OneDriveFileInfo | null {
    // Try personal OneDrive
    let match = url.match(this.patterns.personal);
    if (match) {
      return {
        service: 'onedrive',
        fileId: match[2],
        isSharePoint: false,
        fileType: this.detectFileTypeFromUrl(url),
        url,
      };
    }

    // Try SharePoint with file type prefix
    match = url.match(this.patterns.sharepoint);
    if (match) {
      const fileType = this.fileTypeFromSharePointPrefix(match[2]);
      return {
        service: 'onedrive',
        fileId: match[3],
        isSharePoint: true,
        fileType,
        url,
      };
    }

    // Try SharePoint layouts URL
    match = url.match(this.patterns.sharepointLayouts);
    if (match) {
      return {
        service: 'onedrive',
        fileId: match[2],
        isSharePoint: true,
        driveId: match[1],
        fileType: this.detectFileTypeFromUrl(url),
        url,
      };
    }

    return null;
  }

  async getDownloadUrl(info: OneDriveFileInfo, tab?: chrome.tabs.Tab): Promise<string> {
    // Strategy 1: URL transformation
    const transformedUrl = this.tryUrlTransform(info.url);
    if (transformedUrl) {
      return transformedUrl;
    }

    // Strategy 2: DOM scraping (requires tab) - implemented in subtask 5
    throw new Error('Download URL discovery not yet implemented for this URL type');
  }

  parseTitle(tabTitle: string): string {
    const suffixes = [' - OneDrive', ' - SharePoint'];
    let title = tabTitle;
    for (const suffix of suffixes) {
      if (title.endsWith(suffix)) {
        title = title.slice(0, -suffix.length);
        break;
      }
    }
    return title.trim();
  }

  private tryUrlTransform(url: string): string | null {
    // Try replacing /edit.aspx with /download.aspx
    if (url.includes('/edit.aspx')) {
      return url.replace('/edit.aspx', '/download.aspx');
    }

    // Try replacing /view.aspx with /download.aspx
    if (url.includes('/view.aspx')) {
      return url.replace('/view.aspx', '/download.aspx');
    }

    return null;
  }

  private fileTypeFromSharePointPrefix(prefix: string): FileType {
    switch (prefix) {
      case 'x':
        return 'xlsx';
      case 'w':
        return 'docx';
      case 'p':
        return 'pptx';
      default:
        return 'pdf';
    }
  }

  private detectFileTypeFromUrl(url: string): FileType {
    if (url.includes('Excel') || url.includes('app=Excel')) return 'xlsx';
    if (url.includes('Word') || url.includes('app=Word')) return 'docx';
    if (url.includes('PowerPoint') || url.includes('app=PowerPoint')) return 'pptx';
    return 'pdf';
  }
}

export const oneDriveService = new OneDriveService();

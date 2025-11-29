// Box service handler
// Handles URL detection and download URL construction for Box files

import { BoxFileInfo, ServiceHandler } from '../../types/services';
import { sendToContentScript } from '../../content/messaging';

class BoxService implements ServiceHandler<BoxFileInfo> {
  readonly name = 'Box';
  readonly type = 'box' as const;

  private patterns = {
    // app.box.com/file/{id}
    standard: /^https:\/\/app\.box\.com\/file\/(\d+)/,
    // app.box.com/s/{shared_id}
    shared: /^https:\/\/app\.box\.com\/s\/([a-zA-Z0-9]+)/,
    // enterprise.app.box.com/file/{id}
    enterprise: /^https:\/\/([^.]+)\.app\.box\.com\/file\/(\d+)/,
  };

  detect(url: string): BoxFileInfo | null {
    // Try standard pattern
    let match = url.match(this.patterns.standard);
    if (match) {
      return {
        service: 'box',
        fileId: match[1],
        fileType: 'pdf',
        url,
      };
    }

    // Try shared link
    match = url.match(this.patterns.shared);
    if (match) {
      return {
        service: 'box',
        fileId: match[1],
        fileType: 'pdf',
        url,
      };
    }

    // Try enterprise
    match = url.match(this.patterns.enterprise);
    if (match) {
      return {
        service: 'box',
        fileId: match[2],
        enterpriseId: match[1],
        fileType: 'pdf',
        url,
      };
    }

    return null;
  }

  async getDownloadUrl(info: BoxFileInfo, tab?: chrome.tabs.Tab): Promise<string> {
    if (!tab) {
      throw new Error('Tab required for Box download URL discovery');
    }

    // Strategy 1: DOM scraping to find download button
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        files: ['dist/content/scraper.js'],
      });

      const response = await sendToContentScript(tab.id!, {
        action: 'scrapeDownloadUrl',
        selectors: [
          'a[data-resin-target="download"]',
          'button[data-testid="download-btn"] + a',
          'a.btn-download',
        ],
      });

      if (response.success && response.downloadUrl) {
        return response.downloadUrl;
      }
    } catch {
      // DOM scraping failed, fall through to API endpoint
    }

    // Strategy 2: Construct API endpoint as fallback
    const baseUrl = info.enterpriseId
      ? `https://${info.enterpriseId}.app.box.com`
      : 'https://app.box.com';

    return `${baseUrl}/index.php?rm=box_download_file&file_id=${info.fileId}`;
  }

  parseTitle(tabTitle: string): string {
    const suffixes = [' - Box', ' | Box'];
    let title = tabTitle;
    for (const suffix of suffixes) {
      if (title.endsWith(suffix)) {
        title = title.slice(0, -suffix.length);
        break;
      }
    }
    return title.trim();
  }
}

export const boxService = new BoxService();

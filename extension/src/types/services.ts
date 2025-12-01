// Service handler type definitions
// Shared types for multi-service support (Dropbox, Box, etc.)
// Note: OneDrive/SharePoint support is planned for v2

import { FileType } from './messages';

/**
 * Supported cloud storage services
 */
export type ServiceType = 'google' | 'dropbox' | 'box';

/**
 * Base interface for file info returned by service detection
 */
export interface BaseFileInfo {
  /** The service that owns this file */
  service: ServiceType;
  /** Unique file identifier within the service */
  fileId: string;
  /** Detected file type for opening with correct application */
  fileType: FileType;
  /** Original URL of the file */
  url: string;
}

/**
 * Google Workspace file information
 */
export interface GoogleFileInfo extends BaseFileInfo {
  service: 'google';
  /** The export URL for downloading */
  exportUrl: string;
}

/**
 * Dropbox file information
 */
export interface DropboxFileInfo extends BaseFileInfo {
  service: 'dropbox';
  /** Whether this is a shared link */
  isSharedLink: boolean;
}

/**
 * Box file information
 */
export interface BoxFileInfo extends BaseFileInfo {
  service: 'box';
  /** Enterprise account ID if applicable */
  enterpriseId?: string;
}

/**
 * Union type of all service file info types
 */
export type ServiceFileInfo = GoogleFileInfo | DropboxFileInfo | BoxFileInfo;

/**
 * Alias for compatibility with task specification
 */
export type AnyServiceFileInfo = ServiceFileInfo;

/**
 * Metadata about a registered service
 */
export interface ServiceInfo {
  type: ServiceType;
  name: string;
  displayName: string;
  supportedFileTypes: FileType[];
}

/**
 * Interface for service-specific handlers
 * Each cloud service implements this interface to provide detection and download capabilities
 */
export interface ServiceHandler<T extends ServiceFileInfo = ServiceFileInfo> {
  /** Human-readable service name */
  readonly name: string;
  /** Service type identifier */
  readonly type: ServiceType;

  /**
   * Detect if a URL belongs to this service and extract file info
   * @param url - The URL to check
   * @returns File info if URL matches this service, null otherwise
   */
  detect(url: string): T | null;

  /**
   * Get the download URL for a file
   * @param info - File info from detect()
   * @param tab - Optional Chrome tab for DOM scraping strategies
   * @returns Promise resolving to the download URL
   */
  getDownloadUrl(info: T, tab?: chrome.tabs.Tab): Promise<string>;

  /**
   * Parse the document title from the browser tab title
   * @param tabTitle - The full tab title (e.g., "Document Name - Google Docs")
   * @returns The cleaned document title
   */
  parseTitle(tabTitle: string): string;
}

/**
 * Response from content script when scraping download URL
 */
export interface ContentScriptResponse {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

/**
 * Message sent to content script for DOM scraping
 */
export interface ScrapeDownloadUrlMessage {
  action: 'scrapeDownloadUrl';
  selectors: string[];
}

/**
 * Type guard for GoogleFileInfo
 */
export function isGoogleFileInfo(info: ServiceFileInfo): info is GoogleFileInfo {
  return info.service === 'google';
}

/**
 * Type guard for DropboxFileInfo
 */
export function isDropboxFileInfo(info: ServiceFileInfo): info is DropboxFileInfo {
  return info.service === 'dropbox';
}

/**
 * Type guard for BoxFileInfo
 */
export function isBoxFileInfo(info: ServiceFileInfo): info is BoxFileInfo {
  return info.service === 'box';
}

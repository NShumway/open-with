// Document title parsing utilities
// Extracts and sanitizes document titles for display and filenames

import { SiteConfig } from '../background/site-registry';
import { FileType } from '../types/messages';

/**
 * File extension mapping for each document type
 */
export const FILE_EXTENSIONS: Record<FileType, string> = {
  xlsx: '.xlsx',
  docx: '.docx',
  pptx: '.pptx',
  txt: '.txt',
  pdf: '.pdf',
};

/**
 * Document type display names for each Google service
 */
export const DOC_TYPE_NAMES: Record<string, string> = {
  'Google Sheets': 'spreadsheet',
  'Google Docs': 'document',
  'Google Slides': 'presentation',
};

/**
 * Characters that are unsafe for filenames across operating systems
 */
const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|]/g;

/**
 * Parse and sanitize a document title from the tab title
 *
 * @param tabTitle - The full tab title (e.g., "Q4 Budget - Google Sheets")
 * @param config - The site configuration for the document
 * @returns Sanitized filename without extension
 */
export function parseDocumentTitle(tabTitle: string, config: SiteConfig): string {
  // Pattern to match Google Workspace service suffixes
  const suffixPattern = / - Google (Sheets|Docs|Slides)$/;

  // Remove the Google service suffix
  let title = tabTitle.replace(suffixPattern, '').trim();

  // Sanitize for filesystem safety
  title = title.replace(UNSAFE_FILENAME_CHARS, '');
  title = title.trim();

  // If empty after sanitization, return empty string to trigger fallback
  if (!title) {
    return '';
  }

  return title;
}

/**
 * Extract document ID from URL using the config regex
 * Used as fallback filename when title parsing fails
 */
export function extractDocumentIdFromUrl(url: string, config: SiteConfig): string | null {
  const match = url.match(config.documentIdRegex);
  return match?.[1] || null;
}

/**
 * Build the display filename with extension
 * Prefixes with "open-with-" for consistent naming
 */
export function buildDisplayFilename(title: string, fileType: FileType): string {
  const extension = FILE_EXTENSIONS[fileType];
  return `open-with-${title}${extension}`;
}

/**
 * Get the document type name for display
 */
export function getDocTypeName(config: SiteConfig): string {
  return DOC_TYPE_NAMES[config.name] || 'document';
}

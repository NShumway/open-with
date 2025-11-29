// Site registry for Google Workspace services
// Handles URL pattern matching and document ID extraction
//
// V1/V2 Architecture Bridge:
// This module maintains V1 SiteConfig interface for backward compatibility
// while internally delegating to the V2 service registry system.
// V1 consumers (background/index.ts, popup.ts) can continue using
// getSiteConfig(), extractDocumentId(), etc. without modification.

import { FileType } from '../types/messages';
import { registerService } from './services/index';
import { googleService } from './services/google';
import { dropboxService } from './services/dropbox';
import { oneDriveService } from './services/onedrive';
import { boxService } from './services/box';

// Register all services with service registry on module load
registerService(googleService);
registerService(dropboxService);
registerService(oneDriveService);
registerService(boxService);

/**
 * Configuration for a supported cloud document service
 */
export interface SiteConfig {
  name: string;
  urlPatterns: string[];
  documentIdRegex: RegExp;
  exportUrl: (id: string) => string;
  fileType: FileType;
}

/**
 * Registry of all supported Google Workspace services
 */
const SITE_CONFIGS: SiteConfig[] = [
  {
    name: 'Google Sheets',
    urlPatterns: [
      'https://docs.google.com/spreadsheets/d/*',
      'https://docs.google.com/spreadsheets/u/*/d/*',
    ],
    // Matches both personal (/d/) and Workspace account URLs (/u/0/d/, /u/1/d/, etc.)
    // Anchored to docs.google.com domain
    documentIdRegex:
      /^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
    exportUrl: (id: string) =>
      `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    fileType: 'xlsx' as FileType,
  },
  {
    name: 'Google Docs',
    urlPatterns: [
      'https://docs.google.com/document/d/*',
      'https://docs.google.com/document/u/*/d/*',
    ],
    documentIdRegex:
      /^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
    exportUrl: (id: string) =>
      `https://docs.google.com/document/d/${id}/export?format=docx`,
    fileType: 'docx' as FileType,
  },
  {
    name: 'Google Slides',
    urlPatterns: [
      'https://docs.google.com/presentation/d/*',
      'https://docs.google.com/presentation/u/*/d/*',
    ],
    documentIdRegex:
      /^https:\/\/docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/,
    exportUrl: (id: string) =>
      `https://docs.google.com/presentation/d/${id}/export?format=pptx`,
    fileType: 'pptx' as FileType,
  },
];

/**
 * Find the site configuration matching a URL
 * @param url - The full URL to check
 * @returns The matching SiteConfig or null if not a supported site
 */
export function getSiteConfig(url: string): SiteConfig | null {
  for (const config of SITE_CONFIGS) {
    if (config.documentIdRegex.test(url)) {
      return config;
    }
  }
  return null;
}

/**
 * Validate that a document ID contains only allowed characters.
 * Google document IDs contain alphanumeric characters, hyphens, and underscores.
 * @param documentId - The document ID to validate
 * @returns true if valid, false otherwise
 */
function isValidDocumentId(documentId: string): boolean {
  // Google Doc IDs are typically 44 characters but can vary
  // Must contain only alphanumeric, hyphen, and underscore
  const validPattern = /^[a-zA-Z0-9_-]+$/;

  // Sanity check on length (Google IDs are typically 44 chars, but allow some flexibility)
  if (documentId.length < 10 || documentId.length > 100) {
    return false;
  }

  return validPattern.test(documentId);
}

/**
 * Extract the document ID from a URL using the provided config
 * @param url - The full URL to extract from
 * @param config - The site configuration with the extraction regex
 * @returns The document ID or null if extraction fails or ID is invalid
 */
export function extractDocumentId(url: string, config: SiteConfig): string | null {
  const match = url.match(config.documentIdRegex);
  if (!match || !match[1]) {
    return null;
  }

  const documentId = match[1];

  // Validate the extracted ID contains only expected characters
  if (!isValidDocumentId(documentId)) {
    console.warn('Invalid document ID format detected:', documentId.substring(0, 20) + '...');
    return null;
  }

  return documentId;
}

/**
 * Build the export URL for downloading a document
 * @param config - The site configuration
 * @param documentId - The document ID to export
 * @returns The full export URL
 */
export function buildExportUrl(config: SiteConfig, documentId: string): string {
  return config.exportUrl(documentId);
}

/**
 * Get all URL patterns for use in the extension manifest
 * @returns Array of all URL patterns from all site configs
 */
export function getAllUrlPatterns(): string[] {
  return SITE_CONFIGS.flatMap((config) => config.urlPatterns);
}

/**
 * Parse a URL and return full extraction result if supported
 * @param url - The URL to parse
 * @returns Object with config, documentId, and exportUrl or null
 */
export function parseDocumentUrl(url: string): {
  config: SiteConfig;
  documentId: string;
  exportUrl: string;
} | null {
  const config = getSiteConfig(url);
  if (!config) {
    return null;
  }

  const documentId = extractDocumentId(url, config);
  if (!documentId) {
    return null;
  }

  return {
    config,
    documentId,
    exportUrl: buildExportUrl(config, documentId),
  };
}

export { SITE_CONFIGS };

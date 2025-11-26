// Centralized management of default app information
// Single source of truth for app names and caching

import { getDefaultApps as fetchDefaultApps } from './native-client';
import { DefaultApps, FileType } from '../types/messages';

// Cached default apps - single source of truth
let cachedDefaults: DefaultApps | null = null;

/**
 * Get the cached default apps, fetching if necessary
 * @returns The default apps or null if fetch fails
 */
export async function getDefaultApps(): Promise<DefaultApps | null> {
  if (cachedDefaults) {
    return cachedDefaults;
  }

  try {
    cachedDefaults = await fetchDefaultApps();
    return cachedDefaults;
  } catch (error) {
    console.error('Failed to fetch default apps:', error);
    return null;
  }
}

/**
 * Force refresh of cached default apps
 * @returns The refreshed default apps
 * @throws If fetch fails
 */
export async function refreshDefaultApps(): Promise<DefaultApps> {
  cachedDefaults = await fetchDefaultApps();
  return cachedDefaults;
}

/**
 * Get the cached defaults synchronously (may be null if not yet fetched)
 */
export function getCachedDefaults(): DefaultApps | null {
  return cachedDefaults;
}

/**
 * Get the app name for a given file type
 * @param fileType - The file type to look up
 * @returns The app name or 'desktop app' as fallback
 */
export function getAppName(fileType: FileType): string {
  const appInfo = cachedDefaults?.[fileType];
  return appInfo?.name || 'desktop app';
}

/**
 * Build the "Open in X" title for a file type
 * @param fileType - The file type
 * @returns Formatted title string
 */
export function getOpenInTitle(fileType: FileType): string {
  return `Open in ${getAppName(fileType)}`;
}

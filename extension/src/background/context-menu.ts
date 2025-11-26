// Context menu registration and handling
// Creates right-click menus for supported Google Workspace sites

import { FileType } from '../types/messages';
import { SITE_CONFIGS } from './site-registry';
import { getOpenInTitle } from './app-defaults';

const MENU_ID_PREFIX = 'reclaim-openwith';

/**
 * Register context menus for all supported document types
 * Reads app names from the centralized app-defaults cache
 */
export async function registerContextMenus(): Promise<void> {
  // Remove all existing menus first
  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(resolve);
  });

  // Create menu for each supported site type
  for (const config of SITE_CONFIGS) {
    const menuId = `${MENU_ID_PREFIX}-${config.fileType}`;

    chrome.contextMenus.create({
      id: menuId,
      title: getOpenInTitle(config.fileType),
      contexts: ['page', 'frame', 'selection', 'editable'],
      documentUrlPatterns: config.urlPatterns,
    });
  }
}

/**
 * Extract the file type from a menu item ID
 * @param menuId - The menu item ID (e.g., "reclaim-openwith-xlsx")
 * @returns The file type or null if not a valid menu ID
 */
export function getFileTypeFromMenuId(
  menuId: string | number
): FileType | null {
  const menuIdStr = String(menuId);
  if (!menuIdStr.startsWith(MENU_ID_PREFIX)) {
    return null;
  }

  const match = menuIdStr.match(/reclaim-openwith-(\w+)/);
  if (!match) {
    return null;
  }

  const fileType = match[1] as FileType;

  // Validate it's a known file type
  const validTypes: FileType[] = ['xlsx', 'docx', 'pptx', 'txt', 'pdf'];
  if (!validTypes.includes(fileType)) {
    return null;
  }

  return fileType;
}

/**
 * Check if a menu item ID belongs to this extension
 * @param menuId - The menu item ID to check
 */
export function isOurMenuItem(menuId: string | number): boolean {
  return String(menuId).startsWith(MENU_ID_PREFIX);
}

export { MENU_ID_PREFIX };

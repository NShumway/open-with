// Content script for lightweight page discovery
// Scans DOM for extractable content (tables, text) without heavy processing

import type { TableInfo, DiscoveryResult } from '../types/extraction';

/**
 * Minimum rows/columns for a table to be considered data (not layout)
 */
const MIN_DATA_ROWS = 2;
const MIN_DATA_COLS = 2;

/**
 * Maximum characters for table name
 */
const MAX_NAME_LENGTH = 100;

/**
 * Get a meaningful name for a table element.
 * Priority: caption > aria-label > aria-describedby > nearby heading > id > fallback
 */
export function getTableName(element: HTMLTableElement, index: number): string {
  // 1. Check for caption element
  const caption = element.querySelector('caption');
  if (caption?.textContent?.trim()) {
    return sanitizeName(caption.textContent.trim());
  }

  // 2. Check aria-label attribute
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) {
    return sanitizeName(ariaLabel.trim());
  }

  // 3. Check aria-describedby attribute
  const describedBy = element.getAttribute('aria-describedby');
  if (describedBy) {
    const describedEl = document.getElementById(describedBy);
    if (describedEl?.textContent?.trim()) {
      return sanitizeName(describedEl.textContent.trim());
    }
  }

  // 4. Check preceding heading within 3 siblings
  let sibling: Element | null = element.previousElementSibling;
  let siblingCount = 0;
  while (sibling && siblingCount < 3) {
    if (/^H[1-6]$/.test(sibling.tagName)) {
      const headingText = sibling.textContent?.trim();
      if (headingText) {
        return sanitizeName(headingText);
      }
    }
    sibling = sibling.previousElementSibling;
    siblingCount++;
  }

  // 5. Check id attribute (clean up dashes/underscores)
  const id = element.id;
  if (id) {
    const cleanId = id.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanId) {
      return sanitizeName(cleanId);
    }
  }

  // 6. Fallback to "Table N"
  return `Table ${index + 1}`;
}

/**
 * Sanitize a table name: trim whitespace, limit length
 */
function sanitizeName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length > MAX_NAME_LENGTH) {
    return trimmed.substring(0, MAX_NAME_LENGTH - 3) + '...';
  }
  return trimmed;
}

/**
 * Get preview rows from a table (first N rows, simple text extraction)
 * No colspan/rowspan handling - just for UI display
 */
export function getTablePreview(element: HTMLTableElement, maxRows: number = 3): string[][] {
  const preview: string[][] = [];
  const rows = element.querySelectorAll('tr');

  for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td, th');
    const rowData: string[] = [];

    cells.forEach((cell) => {
      const text = cell.textContent?.trim() || '';
      // Truncate long cell content for preview
      rowData.push(text.length > 50 ? text.substring(0, 47) + '...' : text);
    });

    if (rowData.length > 0) {
      preview.push(rowData);
    }
  }

  return preview;
}

/**
 * Count actual data rows (excluding empty rows)
 */
function countDataRows(element: HTMLTableElement): number {
  const rows = element.querySelectorAll('tr');
  let count = 0;

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td, th');
    // Count row if it has at least one non-empty cell
    const hasContent = Array.from(cells).some(
      (cell) => cell.textContent?.trim()
    );
    if (hasContent) {
      count++;
    }
  });

  return count;
}

/**
 * Count columns (based on first row with cells)
 */
function countColumns(element: HTMLTableElement): number {
  const rows = element.querySelectorAll('tr');

  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    if (cells.length > 0) {
      return cells.length;
    }
  }

  return 0;
}

/**
 * Check if table is likely a layout table (not data)
 */
function isLayoutTable(element: HTMLTableElement): boolean {
  // Check for role="presentation" or role="none"
  const role = element.getAttribute('role');
  if (role === 'presentation' || role === 'none') {
    return true;
  }

  const rowCount = countDataRows(element);
  const colCount = countColumns(element);

  // Single row or single column tables are likely layout
  if (rowCount < MIN_DATA_ROWS || colCount < MIN_DATA_COLS) {
    return true;
  }

  return false;
}

/**
 * Check if table is nested inside another table
 */
function isNestedTable(element: HTMLTableElement): boolean {
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'TABLE') {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Discover all data tables on the page.
 * Returns lightweight metadata only (no full cell extraction).
 */
export function discoverTables(): TableInfo[] {
  const tables = document.querySelectorAll('table');
  const result: TableInfo[] = [];
  let validIndex = 0;

  tables.forEach((table) => {
    // Skip nested tables (we'll process parent table only)
    if (isNestedTable(table)) {
      return;
    }

    // Skip layout tables
    if (isLayoutTable(table)) {
      return;
    }

    const rowCount = countDataRows(table);
    const colCount = countColumns(table);

    result.push({
      index: validIndex,
      name: getTableName(table, validIndex),
      rowCount,
      columnCount: colCount,
      previewRows: getTablePreview(table, 3),
    });

    validIndex++;
  });

  return result;
}

// Store table elements for later extraction (indexed by discovery order)
let discoveredTableElements: HTMLTableElement[] = [];

/**
 * Get table elements discovered in last discoverTables() call.
 * Used by extraction phase to access the actual DOM elements.
 */
export function getDiscoveredTableElements(): HTMLTableElement[] {
  return discoveredTableElements;
}

/**
 * Full discovery function that also caches table elements.
 * Call this instead of discoverTables() when you need to later extract.
 */
export function discoverTablesWithElements(): TableInfo[] {
  const tables = document.querySelectorAll('table');
  const result: TableInfo[] = [];
  discoveredTableElements = [];
  let validIndex = 0;

  tables.forEach((table) => {
    if (isNestedTable(table)) {
      return;
    }

    if (isLayoutTable(table)) {
      return;
    }

    const rowCount = countDataRows(table);
    const colCount = countColumns(table);

    result.push({
      index: validIndex,
      name: getTableName(table, validIndex),
      rowCount,
      columnCount: colCount,
      previewRows: getTablePreview(table, 3),
    });

    discoveredTableElements.push(table);
    validIndex++;
  });

  return result;
}

// Import text discovery functions
import { hasMainContent, getContentPreview, getPageTitle } from './text';

/**
 * Full page discovery - orchestrates table and text discovery.
 * Returns lightweight metadata suitable for rendering UI options.
 * Should execute in <500ms even on heavy pages.
 */
export function discoverContent(): DiscoveryResult {
  // Discover tables (with element caching for later extraction)
  const tables = discoverTablesWithElements();

  // Check for main text content
  const hasContent = hasMainContent();

  // Get content preview only if content exists
  const contentPreview = hasContent ? getContentPreview(200) : '';

  // Get page title
  const pageTitle = getPageTitle();

  return {
    tables,
    hasMainContent: hasContent,
    contentPreview,
    pageTitle,
  };
}

// Expose functions on window for content script injection
declare global {
  interface Window {
    discoverContent: typeof discoverContent;
    discoverTables: typeof discoverTables;
    discoverTablesWithElements: typeof discoverTablesWithElements;
    getDiscoveredTableElements: typeof getDiscoveredTableElements;
  }
}

// Only assign to window in browser environment (not during tests)
if (typeof window !== 'undefined') {
  // @ts-expect-error - Assigning to window for content script access
  window.discoverContent = discoverContent;
  // @ts-expect-error - Assigning to window for content script access
  window.discoverTables = discoverTables;
  // @ts-expect-error - Assigning to window for content script access
  window.discoverTablesWithElements = discoverTablesWithElements;
  // @ts-expect-error - Assigning to window for content script access
  window.getDiscoveredTableElements = getDiscoveredTableElements;
}

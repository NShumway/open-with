// Heavy table extraction module - called on-demand when user clicks XLSX download
// Handles colspan/rowspan by duplicating cell values in the grid

import type { TableData } from '../types/extraction';
import { getTableName, getDiscoveredTableElements } from './discovery';

/**
 * Detect if a table has a header row.
 * Returns true if:
 * - Table has a <thead> element, OR
 * - First row has >50% <th> elements
 */
export function detectHeader(element: HTMLTableElement): boolean {
  // Check for thead element
  const thead = element.querySelector('thead');
  if (thead && thead.querySelector('tr')) {
    return true;
  }

  // Check first row for th elements
  const firstRow = element.querySelector('tr');
  if (!firstRow) {
    return false;
  }

  const cells = firstRow.querySelectorAll('td, th');
  if (cells.length === 0) {
    return false;
  }

  const thCount = firstRow.querySelectorAll('th').length;
  return thCount > cells.length / 2;
}

/**
 * Get text content from a cell, handling images and nested content
 */
function getCellText(cell: Element): string {
  // Check for images and use alt text
  const img = cell.querySelector('img');
  if (img && img.alt && !cell.textContent?.trim()) {
    return img.alt.trim();
  }

  // Get text content, trim whitespace
  const text = cell.textContent?.trim() || '';

  // Normalize whitespace
  return text.replace(/\s+/g, ' ');
}

/**
 * Calculate the actual column count for a table, accounting for colspan
 */
function calculateColumnCount(element: HTMLTableElement): number {
  const rows = element.querySelectorAll('tr');
  let maxCols = 0;

  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    let rowCols = 0;

    cells.forEach((cell) => {
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      rowCols += colspan;
    });

    maxCols = Math.max(maxCols, rowCols);
  }

  return maxCols;
}

/**
 * Extract full table data from an HTMLTableElement.
 * Handles colspan by duplicating values across columns.
 * Handles rowspan by duplicating values down rows.
 */
export function extractTable(element: HTMLTableElement, index: number): TableData {
  const rows = element.querySelectorAll('tr');
  const numCols = calculateColumnCount(element);
  const numRows = rows.length;

  // Initialize grid with empty strings
  const grid: string[][] = Array.from({ length: numRows }, () =>
    Array(numCols).fill('')
  );

  // Track occupied cells (for rowspan handling)
  const occupied: boolean[][] = Array.from({ length: numRows }, () =>
    Array(numCols).fill(false)
  );

  // Process each row
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td, th');
    let colIndex = 0;

    cells.forEach((cell) => {
      // Skip to next unoccupied column
      while (colIndex < numCols && occupied[rowIndex][colIndex]) {
        colIndex++;
      }

      if (colIndex >= numCols) {
        return; // No more space in this row
      }

      const text = getCellText(cell);
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);

      // Fill grid cells for colspan and rowspan
      for (let r = 0; r < rowspan && rowIndex + r < numRows; r++) {
        for (let c = 0; c < colspan && colIndex + c < numCols; c++) {
          grid[rowIndex + r][colIndex + c] = text;
          occupied[rowIndex + r][colIndex + c] = true;
        }
      }

      colIndex += colspan;
    });
  });

  return {
    name: getTableName(element, index),
    data: grid,
    hasHeader: detectHeader(element),
  };
}

/**
 * Extract all tables from cached table elements.
 * This is the HEAVY operation called on-demand when user clicks XLSX button.
 * Uses table elements cached during discovery phase.
 */
export function extractAllTables(): TableData[] {
  const tableElements = getDiscoveredTableElements();
  const results: TableData[] = [];

  tableElements.forEach((element, index) => {
    try {
      const tableData = extractTable(element, index);
      // Skip empty tables
      if (tableData.data.length > 0 && tableData.data[0].length > 0) {
        results.push(tableData);
      }
    } catch (error) {
      console.error(`Failed to extract table ${index}:`, error);
      // Skip malformed tables
    }
  });

  return results;
}

// Expose on window for content script injection
declare global {
  interface Window {
    extractTable: typeof extractTable;
    extractAllTables: typeof extractAllTables;
  }
}

// Only assign to window in browser environment (not during tests)
if (typeof window !== 'undefined') {
  // @ts-expect-error - Assigning to window for content script access
  window.extractTable = extractTable;
  // @ts-expect-error - Assigning to window for content script access
  window.extractAllTables = extractAllTables;
}

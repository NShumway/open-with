// XLSX workbook generation using SheetJS
// Generates multi-sheet Excel workbooks from extracted table data

import * as XLSX from 'xlsx';
import type { TableData } from '../types/extraction';

/**
 * Maximum Excel sheet name length
 */
const MAX_SHEET_NAME_LENGTH = 31;

/**
 * Characters not allowed in Excel sheet names
 */
const INVALID_SHEET_CHARS = /[\\/*?:\[\]]/g;

/**
 * Sanitize a sheet name for Excel compatibility.
 * - Remove invalid characters
 * - Truncate to 31 characters
 * - Avoid empty names
 */
function sanitizeSheetName(name: string): string {
  // Remove invalid characters
  let sanitized = name.replace(INVALID_SHEET_CHARS, '');

  // Remove leading/trailing whitespace
  sanitized = sanitized.trim();

  // Truncate to max length, trying to break at word boundary
  if (sanitized.length > MAX_SHEET_NAME_LENGTH) {
    const truncated = sanitized.substring(0, MAX_SHEET_NAME_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > MAX_SHEET_NAME_LENGTH * 0.6) {
      sanitized = truncated.substring(0, lastSpace).trim();
    } else {
      sanitized = truncated.trim();
    }
  }

  // Ensure non-empty name
  if (!sanitized) {
    sanitized = 'Sheet';
  }

  return sanitized;
}

/**
 * Generate unique sheet names, appending numbers for duplicates.
 */
function deduplicateSheetName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) {
    return name;
  }

  // Try appending numbers
  let counter = 2;
  let newName = `${name} ${counter}`;

  // Truncate if needed when adding number
  while (newName.length > MAX_SHEET_NAME_LENGTH) {
    const suffix = ` ${counter}`;
    const maxBase = MAX_SHEET_NAME_LENGTH - suffix.length;
    newName = name.substring(0, maxBase).trim() + suffix;
    counter++;
  }

  while (existingNames.has(newName)) {
    counter++;
    const suffix = ` ${counter}`;
    const maxBase = MAX_SHEET_NAME_LENGTH - suffix.length;
    newName = name.substring(0, maxBase).trim() + suffix;
  }

  return newName;
}

/**
 * Create an Excel workbook from extracted table data.
 * Each table becomes a separate sheet.
 */
export function createWorkbook(tables: TableData[]): Blob {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const table of tables) {
    // Skip empty tables
    if (!table.data || table.data.length === 0) {
      continue;
    }

    // Create worksheet from 2D array
    const worksheet = XLSX.utils.aoa_to_sheet(table.data);

    // Apply header styling if table has header
    if (table.hasHeader && table.data.length > 0) {
      // Get column count from first row
      const colCount = table.data[0].length;

      // Apply bold to header row (row 1)
      for (let col = 0; col < colCount; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (worksheet[cellRef]) {
          if (!worksheet[cellRef].s) {
            worksheet[cellRef].s = {};
          }
          worksheet[cellRef].s.font = { bold: true };
        }
      }
    }

    // Generate sheet name
    let sheetName = sanitizeSheetName(table.name);
    sheetName = deduplicateSheetName(sheetName, usedNames);
    usedNames.add(sheetName);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // If no valid tables, create empty workbook with placeholder sheet
  if (workbook.SheetNames.length === 0) {
    const emptySheet = XLSX.utils.aoa_to_sheet([['No tables found']]);
    XLSX.utils.book_append_sheet(workbook, emptySheet, 'Sheet1');
  }

  // Write workbook to binary array
  const xlsxData = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });

  // Convert to Blob
  return new Blob([xlsxData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Get the MIME type for XLSX files
 */
export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

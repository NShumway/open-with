// Type definitions for V2 content extraction
// Separates lightweight discovery types from heavy extraction types

// =============================================================================
// Phase 1: Discovery Types (lightweight, metadata only)
// Used for fast page scanning to show UI options
// =============================================================================

/**
 * Lightweight table metadata collected during discovery.
 * Does NOT include full cell data - only enough for UI display.
 */
export interface TableInfo {
  /** Index of the table in discovery order (for referencing during extraction) */
  index: number;
  /** Human-readable name derived from caption, aria-label, or nearby heading */
  name: string;
  /** Number of data rows (excluding header) */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** First 3 rows for preview display (simple text, no colspan/rowspan handling) */
  previewRows: string[][];
}

/**
 * Result of lightweight page discovery.
 * Contains only metadata needed to render extraction options UI.
 */
export interface DiscoveryResult {
  /** Array of discovered tables with metadata (no full data) */
  tables: TableInfo[];
  /** Whether main text content was detected */
  hasMainContent: boolean;
  /** Truncated preview of main content (~200 chars) */
  contentPreview: string;
  /** Page title from document.title */
  pageTitle: string;
}

// =============================================================================
// Phase 3: Extraction Types (heavy, on-demand)
// Used when user clicks download button - full data extraction
// =============================================================================

/**
 * Full table data extracted on-demand.
 * Contains complete 2D array with colspan/rowspan handled.
 */
export interface TableData {
  /** Table name (same as TableInfo.name) */
  name: string;
  /** Full 2D array of all cell values */
  data: string[][];
  /** Whether first row is a header (for formatting in XLSX) */
  hasHeader: boolean;
}

/**
 * Full text content extracted on-demand.
 * Contains complete article text with paragraph structure.
 */
export interface ExtractedContent {
  /** Full extracted text (paragraphs joined with double newlines) */
  text: string;
  /** Array of individual paragraphs (for DOCX generation) */
  paragraphs: string[];
  /** Page title */
  title: string;
}

// =============================================================================
// Message Types for Content Script Communication
// =============================================================================

/**
 * Messages sent from popup to content script for extraction
 */
export type ExtractionMessage =
  | { action: 'discover' }
  | { action: 'extractTables'; tableIndices: number[] }
  | { action: 'extractText' }
  | { action: 'print' };

/**
 * Responses from content script back to popup
 */
export type ExtractionResponse =
  | { success: true; type: 'discovery'; data: DiscoveryResult }
  | { success: true; type: 'tables'; data: TableData[] }
  | { success: true; type: 'text'; data: ExtractedContent }
  | { success: false; error: string };

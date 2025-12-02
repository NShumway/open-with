// Popup script for Reclaim: Open With extension
// Handles UI state management and user interactions

import { detectService, getSupportedServices } from '../background/services/index';
import '../background/site-registry'; // Trigger service registration
import { buildDisplayFilename } from './title-parser';
import { createWorkbook } from '../lib/xlsx-generator';
import { createDocument } from '../lib/docx-generator';
import { createTextFile } from '../lib/txt-generator';
import type { DiscoveryResult, TableData, ExtractedContent } from '../types/extraction';

// DOM element references - V1 states
let supportedEl: HTMLElement;
let unsupportedEl: HTMLElement;
let errorEl: HTMLElement;
let loadingEl: HTMLElement;
let docTypeEl: HTMLElement;
let filenameEl: HTMLElement;
let errorTitleEl: HTMLElement;
let errorMessageEl: HTMLElement;
let errorDetailsEl: HTMLElement;
let errorDetailsContentEl: HTMLElement;

// DOM element references - V2 extraction state
let extractionEl: HTMLElement;
let tablesSectionEl: HTMLElement;
let textSectionEl: HTMLElement;
let pdfSectionEl: HTMLElement;
let tableCountEl: HTMLElement;
let tablePreviewEl: HTMLElement;
let textPreviewEl: HTMLElement;

// DOM element references - V2 extracting/success states
let extractingEl: HTMLElement;
let extractingStatusEl: HTMLElement;
let extractingDetailEl: HTMLElement;
let successEl: HTMLElement;
let successTitleEl: HTMLElement;
let successMessageEl: HTMLElement;

let openBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
let closeBtn: HTMLButtonElement;
let dismissBtn: HTMLButtonElement;
let retryBtn: HTMLButtonElement;
let siteListEl: HTMLElement;

// V2 extraction buttons
let extractXlsxBtn: HTMLButtonElement;
let extractDocxBtn: HTMLButtonElement;
let extractTxtBtn: HTMLButtonElement;
let extractPdfBtn: HTMLButtonElement;

// Current tab information
let currentTabId: number | null = null;

// V2 discovery result (stored for extraction phase)
let discoveryResult: DiscoveryResult | null = null;

// Last extraction operation (for retry functionality)
let lastExtractionOperation: (() => Promise<void>) | null = null;

// Extraction timeout constant (30 seconds)
const EXTRACTION_TIMEOUT_MS = 30000;

/**
 * Initialize DOM element references
 */
function initElements(): void {
  // V1 state elements
  supportedEl = document.getElementById('supported')!;
  unsupportedEl = document.getElementById('unsupported')!;
  errorEl = document.getElementById('error')!;
  loadingEl = document.getElementById('loading')!;
  docTypeEl = document.getElementById('doc-type')!;
  filenameEl = document.getElementById('filename')!;
  errorTitleEl = document.getElementById('error-title')!;
  errorMessageEl = document.getElementById('error-message')!;
  errorDetailsEl = document.getElementById('error-details')!;
  errorDetailsContentEl = document.getElementById('error-details-content')!;

  // V2 extraction state elements
  extractionEl = document.getElementById('extraction')!;
  tablesSectionEl = document.getElementById('tables-section')!;
  textSectionEl = document.getElementById('text-section')!;
  pdfSectionEl = document.getElementById('pdf-section')!;
  tableCountEl = document.getElementById('table-count')!;
  tablePreviewEl = document.getElementById('table-preview')!;
  textPreviewEl = document.getElementById('text-preview')!;

  // V2 extracting/success state elements
  extractingEl = document.getElementById('extracting')!;
  extractingStatusEl = document.getElementById('extracting-status')!;
  extractingDetailEl = document.getElementById('extracting-detail')!;
  successEl = document.getElementById('success')!;
  successTitleEl = document.getElementById('success-title')!;
  successMessageEl = document.getElementById('success-message')!;

  // V1 buttons
  openBtn = document.getElementById('open') as HTMLButtonElement;
  cancelBtn = document.getElementById('cancel') as HTMLButtonElement;
  closeBtn = document.getElementById('close') as HTMLButtonElement;
  dismissBtn = document.getElementById('dismiss') as HTMLButtonElement;
  retryBtn = document.getElementById('retry') as HTMLButtonElement;
  siteListEl = document.querySelector('.site-list')!;

  // V2 extraction buttons
  extractXlsxBtn = document.getElementById('extract-xlsx') as HTMLButtonElement;
  extractDocxBtn = document.getElementById('extract-docx') as HTMLButtonElement;
  extractTxtBtn = document.getElementById('extract-txt') as HTMLButtonElement;
  extractPdfBtn = document.getElementById('extract-pdf') as HTMLButtonElement;
}

/**
 * Populate the service list dynamically from registry
 */
function populateSiteList(): void {
  const services = getSupportedServices();
  siteListEl.innerHTML = '';
  for (const service of services) {
    const li = document.createElement('li');
    li.textContent = service.name;
    siteListEl.appendChild(li);
  }
}

type PopupState = 'supported' | 'unsupported' | 'error' | 'loading' | 'extraction' | 'extracting' | 'success';

/**
 * Show a specific state and hide all others
 */
function showState(state: PopupState): void {
  loadingEl.classList.add('hidden');
  supportedEl.classList.add('hidden');
  unsupportedEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  if (extractionEl) extractionEl.classList.add('hidden');
  if (extractingEl) extractingEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');

  switch (state) {
    case 'supported':
      supportedEl.classList.remove('hidden');
      break;
    case 'unsupported':
      unsupportedEl.classList.remove('hidden');
      break;
    case 'error':
      errorEl.classList.remove('hidden');
      break;
    case 'loading':
      loadingEl.classList.remove('hidden');
      break;
    case 'extraction':
      if (extractionEl) extractionEl.classList.remove('hidden');
      break;
    case 'extracting':
      if (extractingEl) extractingEl.classList.remove('hidden');
      break;
    case 'success':
      if (successEl) successEl.classList.remove('hidden');
      break;
  }
}

/**
 * Setup button click handlers
 */
function setupButtonHandlers(): void {
  // Open button - send message to background and close popup
  openBtn.addEventListener('click', async () => {
    if (currentTabId === null) {
      return;
    }

    // Send message to background script to open the document
    chrome.runtime.sendMessage({
      action: 'openDocument',
      tabId: currentTabId
    });

    // Close popup immediately
    window.close();
  });

  // Cancel button - just close popup
  cancelBtn.addEventListener('click', () => {
    window.close();
  });

  // Close button (unsupported state) - just close popup
  closeBtn.addEventListener('click', () => {
    window.close();
  });

  // Dismiss button (error state) - clear error and close popup
  dismissBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearError' });
    window.close();
  });

  // Retry button (error state) - retry last extraction operation
  if (retryBtn) {
    retryBtn.addEventListener('click', async () => {
      if (lastExtractionOperation) {
        await lastExtractionOperation();
      }
    });
  }

  // V2 extraction button handlers
  setupV2ButtonHandlers();

  // Keyboard shortcuts
  setupKeyboardShortcuts();
}

/**
 * Sanitize filename for cross-platform compatibility
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Invalid chars → underscore
    .replace(/\s+/g, '_')                    // Spaces → underscore
    .substring(0, 200);                       // Truncate (leave room for extension)
}

/**
 * Trigger a file download from a Blob
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup after download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Create a promise that rejects after a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs / 1000} seconds`)), timeoutMs);
    }),
  ]);
}

/**
 * Large table warning threshold
 */
const LARGE_TABLE_THRESHOLD = 5000;

/**
 * Setup V2 extraction button handlers
 */
function setupV2ButtonHandlers(): void {
  // XLSX button - extracts tables and generates Excel workbook
  if (extractXlsxBtn) {
    const handleXlsxExtraction = async () => {
      if (currentTabId === null) return;

      // Store for retry functionality
      lastExtractionOperation = handleXlsxExtraction;

      try {
        // Check for large tables warning
        const totalRows = getTotalTableRows();
        if (totalRows > LARGE_TABLE_THRESHOLD) {
          const proceed = confirm(`Large dataset detected (${totalRows.toLocaleString()} rows). This may take a moment. Continue?`);
          if (!proceed) {
            return;
          }
        }

        showExtracting('XLSX', 'Extracting tables...');

        // Inject content scripts for table extraction into all frames
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          files: ['dist/content/discovery.js', 'dist/content/tables.js'],
        });

        // Call extractAllTables() in all frames with timeout
        const extractionPromise = chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          func: () => {
            // @ts-expect-error - extractAllTables is injected from tables.js
            return window.extractAllTables ? window.extractAllTables() : null;
          },
        });

        const results = await withTimeout(extractionPromise, EXTRACTION_TIMEOUT_MS, 'Table extraction');

        // Aggregate tables from all frames
        const tables: TableData[] = [];
        for (const frame of results) {
          const frameTables = frame.result as TableData[] | null;
          if (frameTables && frameTables.length > 0) {
            // Add frame indicator to table names if from iframe
            for (const table of frameTables) {
              tables.push({
                ...table,
                name: frame.frameId !== 0 ? `${table.name} (iframe)` : table.name,
              });
            }
          }
        }

        if (!tables || tables.length === 0) {
          showV2Error('No Tables Found', 'This page doesn\'t contain any extractable tables.');
          return;
        }

        // Generate XLSX workbook
        showExtracting('XLSX', 'Generating Excel file...');
        const blob = createWorkbook(tables);

        // Get page title for filename
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const baseFilename = sanitizeFilename(tab?.title || 'extracted-tables');

        // Trigger download
        triggerDownload(blob, `${baseFilename}.xlsx`);

        // Show success and auto-close
        showSuccessState('Excel');
      } catch (error) {
        console.error('XLSX extraction failed:', error);
        const err = error as Error;

        if (isProtectedPageError(err)) {
          showV2Error('Can\'t Extract', 'Chrome system pages are protected and cannot be accessed.');
        } else if (err.message.includes('timed out')) {
          showV2Error('Extraction Timeout', 'Page took too long to process. Try refreshing the page and trying again.', err.message, true);
        } else {
          showV2Error('Extraction Failed', 'Failed to extract tables from this page.', err.stack || err.message, true);
        }
      }
    };

    extractXlsxBtn.addEventListener('click', handleXlsxExtraction);
  }

  // DOCX button - extracts text and generates Word document
  if (extractDocxBtn) {
    const handleDocxExtraction = async () => {
      if (currentTabId === null) return;

      // Store for retry functionality
      lastExtractionOperation = handleDocxExtraction;

      try {
        showExtracting('DOCX', 'Extracting content...');

        // Inject content scripts for text extraction into all frames
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          files: ['dist/content/text.js'],
        });

        // Call extractMainContent() in all frames with timeout
        const extractionPromise = chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          func: () => {
            // @ts-expect-error - extractMainContent is injected from text.js
            return window.extractMainContent ? window.extractMainContent() : null;
          },
        });

        const results = await withTimeout(extractionPromise, EXTRACTION_TIMEOUT_MS, 'Content extraction');

        // Aggregate content from all frames (prefer main frame, then combine)
        const content = aggregateTextContent(results);

        if (!content || content.paragraphs.length === 0) {
          showV2Error('No Content Found', 'This page doesn\'t contain extractable text content.');
          return;
        }

        // Generate DOCX document
        showExtracting('DOCX', 'Generating Word document...');
        const blob = await createDocument(content);

        // Get page title for filename
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const baseFilename = sanitizeFilename(tab?.title || 'extracted-content');

        // Trigger download
        triggerDownload(blob, `${baseFilename}.docx`);

        // Show success and auto-close
        showSuccessState('Word');
      } catch (error) {
        console.error('DOCX extraction failed:', error);
        const err = error as Error;

        if (isProtectedPageError(err)) {
          showV2Error('Can\'t Extract', 'Chrome system pages are protected and cannot be accessed.');
        } else if (err.message.includes('timed out')) {
          showV2Error('Extraction Timeout', 'Page took too long to process. Try refreshing the page and trying again.', err.message, true);
        } else {
          showV2Error('Extraction Failed', 'Failed to extract content from this page.', err.stack || err.message, true);
        }
      }
    };

    extractDocxBtn.addEventListener('click', handleDocxExtraction);
  }

  // TXT button - extracts text and generates plain text file
  if (extractTxtBtn) {
    const handleTxtExtraction = async () => {
      if (currentTabId === null) return;

      // Store for retry functionality
      lastExtractionOperation = handleTxtExtraction;

      try {
        showExtracting('TXT', 'Extracting content...');

        // Inject content scripts for text extraction into all frames
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          files: ['dist/content/text.js'],
        });

        // Call extractMainContent() in all frames with timeout
        const extractionPromise = chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          func: () => {
            // @ts-expect-error - extractMainContent is injected from text.js
            return window.extractMainContent ? window.extractMainContent() : null;
          },
        });

        const results = await withTimeout(extractionPromise, EXTRACTION_TIMEOUT_MS, 'Content extraction');

        // Aggregate content from all frames (prefer main frame, then combine)
        const content = aggregateTextContent(results);

        if (!content || content.paragraphs.length === 0) {
          showV2Error('No Content Found', 'This page doesn\'t contain extractable text content.');
          return;
        }

        // Generate TXT file
        showExtracting('TXT', 'Generating text file...');
        const blob = createTextFile(content);

        // Get page title for filename
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const baseFilename = sanitizeFilename(tab?.title || 'extracted-content');

        // Trigger download
        triggerDownload(blob, `${baseFilename}.txt`);

        // Show success and auto-close
        showSuccessState('Text');
      } catch (error) {
        console.error('TXT extraction failed:', error);
        const err = error as Error;

        if (isProtectedPageError(err)) {
          showV2Error('Can\'t Extract', 'Chrome system pages are protected and cannot be accessed.');
        } else if (err.message.includes('timed out')) {
          showV2Error('Extraction Timeout', 'Page took too long to process. Try refreshing the page and trying again.', err.message, true);
        } else {
          showV2Error('Extraction Failed', 'Failed to extract content from this page.', err.stack || err.message, true);
        }
      }
    };

    extractTxtBtn.addEventListener('click', handleTxtExtraction);
  }

  // PDF button - uses browser's print dialog (main frame only)
  if (extractPdfBtn) {
    extractPdfBtn.addEventListener('click', async () => {
      if (currentTabId === null) return;

      try {
        // Inject content script to call window.print() (main frame only, no allFrames)
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => {
            window.print();
          },
        });

        // Close popup after triggering print
        window.close();
      } catch (error) {
        console.error('Print failed:', error);
        const err = error as Error;

        if (isProtectedPageError(err)) {
          showV2Error('Can\'t Print', 'Chrome system pages are protected and cannot be accessed.');
        } else {
          showV2Error('Print Failed', 'Failed to open print dialog.', err.message);
        }
      }
    });
  }
}

/**
 * Show extracting state with progress message
 */
function showExtracting(operation: 'XLSX' | 'DOCX' | 'TXT' | 'PDF', status: string): void {
  if (extractingStatusEl) {
    extractingStatusEl.textContent = status;
  }
  if (extractingDetailEl) {
    extractingDetailEl.textContent = `Preparing ${operation} file...`;
  }
  showState('extracting');
}

/**
 * Show success state with auto-close
 */
function showSuccessState(operation: string): void {
  if (successTitleEl) {
    successTitleEl.textContent = 'Done!';
  }
  if (successMessageEl) {
    successMessageEl.textContent = `Your ${operation} file is ready.`;
  }
  showState('success');

  // Auto-close after 1 second
  setTimeout(() => {
    window.close();
  }, 1000);
}

/**
 * Show V2 error state with optional details and retry button
 */
function showV2Error(title: string, message: string, details?: string, recoverable = false): void {
  errorTitleEl.textContent = title;
  errorMessageEl.textContent = message;

  // Show/hide technical details
  if (details && errorDetailsEl && errorDetailsContentEl) {
    errorDetailsContentEl.textContent = details;
    errorDetailsEl.classList.remove('hidden');
  } else if (errorDetailsEl) {
    errorDetailsEl.classList.add('hidden');
  }

  // Show/hide retry button
  if (retryBtn) {
    if (recoverable && lastExtractionOperation) {
      retryBtn.classList.remove('hidden');
    } else {
      retryBtn.classList.add('hidden');
    }
  }

  showState('error');

  // Focus dismiss button for keyboard accessibility
  dismissBtn?.focus();
}

/**
 * Check if error is a protected page error
 */
function isProtectedPageError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('cannot access') ||
    msg.includes('chrome-extension://') ||
    msg.includes('chrome://') ||
    msg.includes('cannot be scripted')
  );
}

/**
 * Calculate total rows across all tables
 */
function getTotalTableRows(): number {
  if (!discoveryResult) return 0;
  return discoveryResult.tables.reduce((sum, t) => sum + t.rowCount, 0);
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Find and click the primary button that's visible and enabled
      const primaryBtn = document.querySelector('.primary:not(:disabled):not(.hidden)') as HTMLButtonElement;
      if (primaryBtn && !primaryBtn.closest('.hidden')) {
        primaryBtn.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      window.close();
    }
  });
}

/**
 * Show V2 extraction UI with discovered content
 */
function showExtraction(result: DiscoveryResult): void {
  // Store result for extraction handlers
  discoveryResult = result;

  // Show/hide tables section based on discovery
  if (tablesSectionEl && result.tables.length > 0) {
    tablesSectionEl.classList.remove('hidden');
    if (tableCountEl) {
      tableCountEl.textContent = String(result.tables.length);
    }
    if (tablePreviewEl) {
      // Show first table's preview
      const firstTable = result.tables[0];
      const previewHtml = firstTable.previewRows
        .slice(0, 2)
        .map(row => row.join(' | '))
        .join('<br>');
      tablePreviewEl.innerHTML = `<strong>${firstTable.name}</strong> (${firstTable.rowCount} rows × ${firstTable.columnCount} cols)<br>${previewHtml}`;
    }
  } else if (tablesSectionEl) {
    tablesSectionEl.classList.add('hidden');
  }

  // Show/hide text section based on discovery
  if (textSectionEl && result.hasMainContent) {
    textSectionEl.classList.remove('hidden');
    if (textPreviewEl) {
      textPreviewEl.textContent = result.contentPreview;
    }
  } else if (textSectionEl) {
    textSectionEl.classList.add('hidden');
  }

  // PDF section is always shown (if element exists)
  if (pdfSectionEl) {
    pdfSectionEl.classList.remove('hidden');
  }

  showState('extraction');
}

/**
 * Aggregate text content from multiple frames
 */
function aggregateTextContent(results: Array<{ result?: ExtractedContent | null; frameId?: number }>): ExtractedContent | null {
  // Prefer main frame content if available
  const mainFrame = results.find(r => r.frameId === 0 && r.result && r.result.paragraphs.length > 0);
  if (mainFrame?.result) {
    return mainFrame.result;
  }

  // Otherwise, combine content from all frames
  const combined: ExtractedContent = {
    text: '',
    paragraphs: [],
    title: '',
  };

  for (const frame of results) {
    const content = frame.result;
    if (!content) continue;

    // Take title from first frame that has one
    if (!combined.title && content.title) {
      combined.title = content.title;
    }

    // Add paragraphs from this frame
    if (content.paragraphs.length > 0) {
      combined.paragraphs.push(...content.paragraphs);
    }
  }

  // Rebuild text from combined paragraphs
  combined.text = combined.paragraphs.join('\n\n');

  return combined.paragraphs.length > 0 ? combined : null;
}

/**
 * Aggregate discovery results from multiple frames
 */
function aggregateDiscoveryResults(results: Array<{ result?: DiscoveryResult | null; frameId?: number }>): DiscoveryResult {
  const aggregated: DiscoveryResult = {
    tables: [],
    hasMainContent: false,
    contentPreview: '',
    pageTitle: '',
  };

  let tableIndex = 0;

  for (const frame of results) {
    const discovery = frame.result;
    if (!discovery) continue;

    // Take page title from main frame (frameId 0) if available
    if (frame.frameId === 0 && discovery.pageTitle) {
      aggregated.pageTitle = discovery.pageTitle;
    } else if (!aggregated.pageTitle && discovery.pageTitle) {
      aggregated.pageTitle = discovery.pageTitle;
    }

    // Aggregate tables with renumbered indices
    for (const table of discovery.tables) {
      aggregated.tables.push({
        ...table,
        index: tableIndex++,
        name: discovery.tables.length > 1 || results.length > 1
          ? `${table.name}${frame.frameId !== 0 ? ' (iframe)' : ''}`
          : table.name,
      });
    }

    // Take main content from first frame that has it (prefer main frame)
    if (discovery.hasMainContent && !aggregated.hasMainContent) {
      aggregated.hasMainContent = true;
      aggregated.contentPreview = discovery.contentPreview;
    }
  }

  return aggregated;
}

/**
 * Try V2 content discovery for non-cloud-service pages
 * Scans main frame and all accessible iframes
 */
async function tryV2Discovery(tabId: number, url: string): Promise<void> {
  // Check if URL is injectable (not chrome://, chrome-extension://, etc.)
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    showState('unsupported');
    return;
  }

  try {
    // Inject discovery content scripts into all frames
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['dist/content/text.js', 'dist/content/discovery.js'],
    });

    // Execute discovery function in all frames
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        // @ts-expect-error - discoverContent is injected from discovery.js
        return window.discoverContent ? window.discoverContent() : null;
      },
    });

    // Filter out null results and aggregate
    const validResults = results
      .filter(r => r.result !== null)
      .map(r => ({ result: r.result as DiscoveryResult, frameId: r.frameId }));

    if (validResults.length === 0) {
      console.error('Discovery returned null from all frames');
      showState('unsupported');
      return;
    }

    // Aggregate results from all frames
    const discovery = aggregateDiscoveryResults(validResults);

    // Check if page has any extractable content
    if (discovery.tables.length === 0 && !discovery.hasMainContent) {
      showState('unsupported');
      return;
    }

    // Show extraction UI
    showExtraction(discovery);
  } catch (error) {
    console.error('V2 discovery failed:', error);
    showState('unsupported');
  }
}

/**
 * Initialize popup and determine state
 */
async function init(): Promise<void> {
  initElements();
  setupButtonHandlers();
  populateSiteList();

  try {
    // Query the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url) {
      showState('unsupported');
      return;
    }

    currentTabId = tab.id;

    // Check if there's a cached error from the background script
    const { error } = await chrome.runtime.sendMessage({ action: 'getError' });

    if (error && error.tabId === tab.id) {
      // Show the cached error details
      errorTitleEl.textContent = error.title;
      errorMessageEl.textContent = error.message;
      showState('error');

      // Clear the error since user has now seen it
      await chrome.runtime.sendMessage({ action: 'clearError' });
      return;
    }

    // Check if this is a supported cloud service page (V1 flow)
    const detection = detectService(tab.url);
    if (!detection) {
      // Not a cloud service - try V2 content extraction
      await tryV2Discovery(tab.id, tab.url);
      return;
    }

    // V1 flow: Cloud service detected
    const { handler, info } = detection;

    // Parse the document title using service handler
    let title = tab.title ? handler.parseTitle(tab.title) : '';

    // Fallback to file ID if title is empty
    if (!title) {
      title = info.fileId ? `document-${info.fileId.substring(0, 8)}` : 'document';
    }

    // Build display filename using info.fileType
    const displayFilename = buildDisplayFilename(title, info.fileType);

    // Update UI with service name
    docTypeEl.textContent = handler.name;
    filenameEl.textContent = displayFilename;
    filenameEl.title = displayFilename; // For tooltip on hover

    showState('supported');
  } catch (error) {
    console.error('Popup initialization error:', error);
    showState('unsupported');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Popup script for Reclaim: Open With extension
// Handles UI state management and user interactions

import { detectService, getSupportedServices } from '../background/services/index';
import '../background/site-registry'; // Trigger service registration
import { buildDisplayFilename } from './title-parser';

// DOM element references
let supportedEl: HTMLElement;
let unsupportedEl: HTMLElement;
let errorEl: HTMLElement;
let loadingEl: HTMLElement;
let docTypeEl: HTMLElement;
let filenameEl: HTMLElement;
let errorTitleEl: HTMLElement;
let errorMessageEl: HTMLElement;

let openBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
let closeBtn: HTMLButtonElement;
let dismissBtn: HTMLButtonElement;
let siteListEl: HTMLElement;

// Current tab information
let currentTabId: number | null = null;

/**
 * Initialize DOM element references
 */
function initElements(): void {
  supportedEl = document.getElementById('supported')!;
  unsupportedEl = document.getElementById('unsupported')!;
  errorEl = document.getElementById('error')!;
  loadingEl = document.getElementById('loading')!;
  docTypeEl = document.getElementById('doc-type')!;
  filenameEl = document.getElementById('filename')!;
  errorTitleEl = document.getElementById('error-title')!;
  errorMessageEl = document.getElementById('error-message')!;

  openBtn = document.getElementById('open') as HTMLButtonElement;
  cancelBtn = document.getElementById('cancel') as HTMLButtonElement;
  closeBtn = document.getElementById('close') as HTMLButtonElement;
  dismissBtn = document.getElementById('dismiss') as HTMLButtonElement;
  siteListEl = document.querySelector('.site-list')!;
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

/**
 * Show a specific state and hide all others
 */
function showState(state: 'supported' | 'unsupported' | 'error' | 'loading'): void {
  loadingEl.classList.add('hidden');
  supportedEl.classList.add('hidden');
  unsupportedEl.classList.add('hidden');
  errorEl.classList.add('hidden');

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

    // Check if this is a supported page using service registry
    const detection = detectService(tab.url);
    if (!detection) {
      showState('unsupported');
      return;
    }

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

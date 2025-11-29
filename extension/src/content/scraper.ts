// Content script for DOM scraping
// Injected into pages to find download URLs

import { setupContentScriptListener } from './messaging';

// Initialize the content script listener when loaded
setupContentScriptListener();

console.log('[Open With] Scraper content script loaded');

// Content script for text content discovery and extraction
// Provides both lightweight discovery AND heavy on-demand extraction

import type { ExtractedContent } from '../types/extraction';

/**
 * Minimum text length to consider as meaningful content
 */
const MIN_CONTENT_LENGTH = 100;

/**
 * Tags to exclude from content detection
 */
const EXCLUDED_TAGS = new Set([
  'NAV',
  'FOOTER',
  'HEADER',
  'ASIDE',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'FORM',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
]);

/**
 * Patterns in class/id that indicate non-content elements
 */
const EXCLUDED_PATTERNS = /nav|menu|sidebar|footer|header|comment|ad|promo|related|widget|social|share|subscribe|newsletter/i;

/**
 * Get the page title
 */
export function getPageTitle(): string {
  return document.title || '';
}

/**
 * Check if an element should be excluded from content detection
 */
function isExcludedElement(element: Element): boolean {
  // Check tag name
  if (EXCLUDED_TAGS.has(element.tagName)) {
    return true;
  }

  // Check class and id for excluded patterns
  const classAndId = (element.className || '') + ' ' + (element.id || '');
  if (EXCLUDED_PATTERNS.test(classAndId)) {
    return true;
  }

  // Check if hidden
  if (element instanceof HTMLElement) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }
  }

  return false;
}

/**
 * Calculate text density of an element (text length / HTML length ratio)
 */
function getTextDensity(element: Element): number {
  const text = element.textContent || '';
  const html = element.innerHTML || '';

  if (html.length === 0) return 0;

  // Clean text: remove excessive whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();

  return cleanText.length / html.length;
}

/**
 * Find the main content element using simple heuristics.
 * This is a lightweight check - NOT the full readability algorithm.
 */
function findMainContentElement(): Element | null {
  // 1. Check for semantic content elements (high priority)
  const semanticSelectors = [
    'article',
    'main',
    '[role="main"]',
    '[role="article"]',
  ];

  for (const selector of semanticSelectors) {
    const element = document.querySelector(selector);
    if (element && !isExcludedElement(element)) {
      const text = element.textContent?.trim() || '';
      if (text.length >= MIN_CONTENT_LENGTH) {
        return element;
      }
    }
  }

  // 2. Look for common content class patterns
  const contentSelectors = [
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content-body',
    '.article-body',
    '.story-body',
    '#content',
    '#main-content',
    '.main-content',
  ];

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && !isExcludedElement(element)) {
      const text = element.textContent?.trim() || '';
      if (text.length >= MIN_CONTENT_LENGTH) {
        return element;
      }
    }
  }

  // 3. Find element with highest text density among paragraphs
  const paragraphs = document.querySelectorAll('p');
  let bestParent: Element | null = null;
  let bestScore = 0;

  paragraphs.forEach((p) => {
    const parent = p.parentElement;
    if (!parent || isExcludedElement(parent)) return;

    const text = parent.textContent?.trim() || '';
    if (text.length < MIN_CONTENT_LENGTH) return;

    const density = getTextDensity(parent);
    const paragraphCount = parent.querySelectorAll('p').length;

    // Score based on text density and paragraph count
    const score = density * Math.min(paragraphCount, 10);

    if (score > bestScore) {
      bestScore = score;
      bestParent = parent;
    }
  });

  return bestParent;
}

/**
 * Quick check if page has extractable main content.
 * Should execute in <50ms.
 */
export function hasMainContent(): boolean {
  const mainElement = findMainContentElement();
  if (!mainElement) return false;

  const text = mainElement.textContent?.trim() || '';
  return text.length >= MIN_CONTENT_LENGTH;
}

/**
 * Get a preview snippet of the main content.
 * Returns first meaningful text up to maxLength characters.
 */
export function getContentPreview(maxLength: number = 200): string {
  const mainElement = findMainContentElement();
  if (!mainElement) return '';

  // Try to find first paragraph for cleaner preview
  const firstParagraph = mainElement.querySelector('p');
  let previewText = '';

  if (firstParagraph) {
    previewText = firstParagraph.textContent?.trim() || '';
  }

  // Fall back to main element text if no paragraph or too short
  if (previewText.length < 50) {
    previewText = mainElement.textContent?.trim() || '';
  }

  // Clean up whitespace
  previewText = previewText.replace(/\s+/g, ' ').trim();

  // Truncate if needed
  if (previewText.length > maxLength) {
    // Try to truncate at word boundary
    const truncated = previewText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  }

  return previewText;
}

/**
 * Get the main content element reference for later extraction.
 * Used by the extraction phase to know where to extract from.
 */
export function getMainContentElement(): Element | null {
  return findMainContentElement();
}

// =============================================================================
// Phase 3: Heavy extraction (on-demand when user clicks DOCX/TXT download)
// =============================================================================

/**
 * Minimum paragraph length to include in extraction
 */
const MIN_PARAGRAPH_LENGTH = 20;

/**
 * Tags that represent paragraph-level content
 */
const PARAGRAPH_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE']);

/**
 * Score an element for content quality using readability-style heuristics.
 * Higher score = more likely to be main content.
 */
function scoreElement(element: Element): number {
  let score = 0;

  // Semantic tag bonuses
  const tagName = element.tagName.toUpperCase();
  if (tagName === 'ARTICLE') score += 15;
  if (tagName === 'MAIN') score += 10;

  // Role attribute bonuses
  const role = element.getAttribute('role');
  if (role === 'main' || role === 'article') score += 10;

  // Penalize non-content patterns in class/id
  const classAndId = (element.className || '') + ' ' + (element.id || '');
  if (EXCLUDED_PATTERNS.test(classAndId)) {
    score -= 10;
  }

  // Content class pattern bonuses
  if (/article|content|post|entry|story|body|text/i.test(classAndId)) {
    score += 5;
  }

  // Text density scoring
  const textDensity = getTextDensity(element);
  score += textDensity * 20; // Scale density to meaningful score

  // Paragraph count bonus
  const paragraphs = element.querySelectorAll('p');
  score += Math.min(paragraphs.length, 10) * 2;

  // Link density penalty
  const links = element.querySelectorAll('a');
  const textLength = (element.textContent || '').length;
  let linkTextLength = 0;
  links.forEach((link) => {
    linkTextLength += (link.textContent || '').length;
  });
  const linkDensity = textLength > 0 ? linkTextLength / textLength : 0;
  if (linkDensity > 0.3) {
    score -= 15;
  }

  // Length requirement
  const text = element.textContent?.trim() || '';
  if (text.length < MIN_CONTENT_LENGTH) {
    score = 0; // Disqualify too-short elements
  }

  return score;
}

/**
 * Find the best content element using full readability-style scoring.
 * More thorough than findMainContentElement() - used for extraction.
 */
function findBestContentElement(): Element | null {
  // First try semantic elements
  const candidates: Element[] = [];

  // Add semantic elements
  document.querySelectorAll('article, main, [role="main"], [role="article"]').forEach((el) => {
    if (!isExcludedElement(el)) {
      candidates.push(el);
    }
  });

  // Add common content class elements
  document.querySelectorAll('.article-content, .post-content, .entry-content, .content-body, .article-body, .story-body, #content, #main-content, .main-content').forEach((el) => {
    if (!isExcludedElement(el)) {
      candidates.push(el);
    }
  });

  // Add div/section elements with paragraphs
  document.querySelectorAll('div, section').forEach((el) => {
    if (!isExcludedElement(el) && el.querySelectorAll('p').length >= 2) {
      candidates.push(el);
    }
  });

  // Score all candidates
  let bestElement: Element | null = null;
  let bestScore = 5; // Lower threshold to find content

  candidates.forEach((element) => {
    const score = scoreElement(element);
    if (score > bestScore) {
      bestScore = score;
      bestElement = element;
    }
  });

  return bestElement;
}

/**
 * Extract paragraph text from an element, preserving structure.
 * Recursively walks DOM tree and extracts text from paragraph-level elements.
 */
function extractParagraphs(element: Element): string[] {
  const paragraphs: string[] = [];
  const seen = new Set<string>(); // Deduplicate

  // Recursive function to walk DOM
  function walkElement(el: Element): void {
    // Skip excluded elements entirely
    if (isExcludedElement(el)) {
      return;
    }

    // Check if this is a paragraph-level element
    if (PARAGRAPH_TAGS.has(el.tagName)) {
      let text = el.textContent?.trim() || '';

      // Normalize whitespace
      text = text.replace(/\s+/g, ' ').trim();

      // Skip short paragraphs (likely junk)
      if (text.length >= MIN_PARAGRAPH_LENGTH) {
        // Skip duplicates
        if (!seen.has(text)) {
          seen.add(text);
          paragraphs.push(text);
        }
      }
      // Don't recurse into paragraph-level elements
      return;
    }

    // Recurse into children
    for (const child of el.children) {
      walkElement(child);
    }
  }

  walkElement(element);
  return paragraphs;
}

/**
 * Extract full main content on-demand.
 * This is the HEAVY operation called when user clicks DOCX/TXT download.
 * Returns structured content with paragraphs preserved.
 */
export function extractMainContent(): ExtractedContent {
  const contentElement = findBestContentElement();
  const title = getPageTitle();

  if (!contentElement) {
    return {
      text: '',
      paragraphs: [],
      title,
    };
  }

  const paragraphs = extractParagraphs(contentElement);
  const text = paragraphs.join('\n\n');

  return {
    text,
    paragraphs,
    title,
  };
}

// =============================================================================
// Window exports for content script injection
// =============================================================================

declare global {
  interface Window {
    hasMainContent: typeof hasMainContent;
    getContentPreview: typeof getContentPreview;
    getPageTitle: typeof getPageTitle;
    getMainContentElement: typeof getMainContentElement;
    extractMainContent: typeof extractMainContent;
  }
}

// Only assign to window in browser environment (not during tests)
if (typeof window !== 'undefined') {
  // @ts-expect-error - Assigning to window for content script access
  window.hasMainContent = hasMainContent;
  // @ts-expect-error - Assigning to window for content script access
  window.getContentPreview = getContentPreview;
  // @ts-expect-error - Assigning to window for content script access
  window.getPageTitle = getPageTitle;
  // @ts-expect-error - Assigning to window for content script access
  window.getMainContentElement = getMainContentElement;
  // @ts-expect-error - Assigning to window for content script access
  window.extractMainContent = extractMainContent;
}

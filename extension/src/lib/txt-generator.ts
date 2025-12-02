// TXT file generation
// Generates plain text files from extracted content

import type { ExtractedContent } from '../types/extraction';

/**
 * MIME type for UTF-8 text files
 */
export const TXT_MIME_TYPE = 'text/plain;charset=utf-8';

/**
 * Normalize line endings to Unix style (\n)
 */
function normalizeLineEndings(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Windows → Unix
    .replace(/\r/g, '\n');  // Old Mac → Unix
}

/**
 * Create a plain text file from extracted content.
 * Structure: Title, blank line, body paragraphs separated by double newlines.
 */
export function createTextFile(content: ExtractedContent): Blob {
  // Use fallback title if not provided
  const title = content.title?.trim() || 'Extracted Content';

  // Filter out empty paragraphs and normalize line endings
  const validParagraphs = content.paragraphs
    .filter(p => p.trim().length > 0)
    .map(p => normalizeLineEndings(p));

  // Build text content
  let text = title;

  if (validParagraphs.length > 0) {
    // Add blank line after title, then body
    text += '\n\n' + validParagraphs.join('\n\n');
  }

  // Final normalization
  text = normalizeLineEndings(text);

  // Create UTF-8 encoded blob
  return new Blob([text], { type: TXT_MIME_TYPE });
}

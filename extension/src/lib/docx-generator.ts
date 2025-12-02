// DOCX document generation using docx library
// Generates Word documents from extracted text content

import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import type { ExtractedContent } from '../types/extraction';

/**
 * MIME type for DOCX files
 */
export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Create a Word document from extracted content.
 * Async function that returns a Blob for download.
 */
export async function createDocument(content: ExtractedContent): Promise<Blob> {
  // Use fallback title if not provided
  const title = content.title?.trim() || 'Extracted Content';

  // Filter out empty paragraphs
  const validParagraphs = content.paragraphs.filter(p => p.trim().length > 0);

  // Build document children: title + body paragraphs
  const children: Paragraph[] = [
    // Title paragraph (Heading 1, bold)
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 }, // 240 twips = 1 line (12pt)
    }),
  ];

  // Add body paragraphs
  for (const text of validParagraphs) {
    children.push(
      new Paragraph({
        children: [new TextRun(text)],
        spacing: { after: 120 }, // 120 twips = half line (6pt)
      })
    );
  }

  // Create document with single section
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // Generate blob using Packer
  const blob = await Packer.toBlob(doc);
  return blob;
}

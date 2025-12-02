import { describe, it, expect } from 'vitest';
import { createDocument, DOCX_MIME_TYPE } from './docx-generator';
import type { ExtractedContent } from '../types/extraction';

describe('createDocument', () => {
  it('should create a valid DOCX blob from content', async () => {
    const content: ExtractedContent = {
      title: 'Test Article',
      paragraphs: [
        'First paragraph with some content.',
        'Second paragraph with more content.',
        'Third paragraph to complete the article.',
      ],
      text: 'First paragraph with some content.\n\nSecond paragraph with more content.\n\nThird paragraph to complete the article.',
    };

    const blob = await createDocument(content);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(DOCX_MIME_TYPE);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should use fallback title when title is empty', async () => {
    const content: ExtractedContent = {
      title: '',
      paragraphs: ['Some content paragraph.'],
      text: 'Some content paragraph.',
    };

    const blob = await createDocument(content);

    // Should not throw and should create valid blob
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should use fallback title when title is undefined', async () => {
    const content: ExtractedContent = {
      title: undefined as unknown as string,
      paragraphs: ['Some content paragraph.'],
      text: 'Some content paragraph.',
    };

    const blob = await createDocument(content);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should filter out empty paragraphs', async () => {
    const content: ExtractedContent = {
      title: 'Test Title',
      paragraphs: [
        'Valid paragraph one.',
        '',
        '   ',
        'Valid paragraph two.',
        '',
      ],
      text: 'Valid paragraph one.\n\nValid paragraph two.',
    };

    const blob = await createDocument(content);

    expect(blob).toBeInstanceOf(Blob);
    // Should create valid document without empty paragraphs
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle single paragraph', async () => {
    const content: ExtractedContent = {
      title: 'Single Paragraph Doc',
      paragraphs: ['This is the only paragraph in the document.'],
      text: 'This is the only paragraph in the document.',
    };

    const blob = await createDocument(content);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle long content with many paragraphs', async () => {
    const paragraphs = Array(100)
      .fill(null)
      .map((_, i) => `Paragraph ${i + 1}: This is a longer paragraph with some content to simulate real article text. It contains multiple sentences and should be included in the final document.`);

    const content: ExtractedContent = {
      title: 'Long Article',
      paragraphs,
      text: paragraphs.join('\n\n'),
    };

    const blob = await createDocument(content);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle special characters in content', async () => {
    const content: ExtractedContent = {
      title: 'Special Characters Test: <>&"\' ©®™',
      paragraphs: [
        'Math symbols: ∑ ∏ √ ∞ ≈ ≠ ≤ ≥',
        'Accented: é à ü ñ ç ß',
        'Asian: 中文 日本語 한국어',
        'Emoji: 🎉 🚀 ✨',
      ],
      text: 'Content with special characters.',
    };

    const blob = await createDocument(content);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle empty paragraphs array', async () => {
    const content: ExtractedContent = {
      title: 'Title Only',
      paragraphs: [],
      text: '',
    };

    const blob = await createDocument(content);

    // Should create document with just title
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should return a Promise', () => {
    const content: ExtractedContent = {
      title: 'Test',
      paragraphs: ['Content.'],
      text: 'Content.',
    };

    const result = createDocument(content);

    expect(result).toBeInstanceOf(Promise);
  });
});

describe('DOCX_MIME_TYPE', () => {
  it('should be correct MIME type for docx files', () => {
    expect(DOCX_MIME_TYPE).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });
});

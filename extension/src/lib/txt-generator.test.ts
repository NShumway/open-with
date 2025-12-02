import { describe, it, expect } from 'vitest';
import { createTextFile, TXT_MIME_TYPE } from './txt-generator';
import type { ExtractedContent } from '../types/extraction';

describe('createTextFile', () => {
  it('should create a valid TXT blob from content', async () => {
    const content: ExtractedContent = {
      title: 'Test Article',
      paragraphs: [
        'First paragraph.',
        'Second paragraph.',
        'Third paragraph.',
      ],
      text: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
    };

    const blob = createTextFile(content);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(TXT_MIME_TYPE);

    // Read blob content
    const text = await blob.text();
    expect(text.startsWith('Test Article\n\n')).toBe(true);
    expect(text).toContain('First paragraph.');
    expect(text).toContain('Second paragraph.');
    expect(text).toContain('Third paragraph.');
  });

  it('should separate paragraphs with double newlines', async () => {
    const content: ExtractedContent = {
      title: 'Title',
      paragraphs: ['Para 1', 'Para 2', 'Para 3'],
      text: 'Para 1\n\nPara 2\n\nPara 3',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    // Check structure: Title\n\nPara 1\n\nPara 2\n\nPara 3
    expect(text).toBe('Title\n\nPara 1\n\nPara 2\n\nPara 3');
  });

  it('should use fallback title when title is empty', async () => {
    const content: ExtractedContent = {
      title: '',
      paragraphs: ['Some content.'],
      text: 'Some content.',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text.startsWith('Extracted Content\n\n')).toBe(true);
  });

  it('should use fallback title when title is undefined', async () => {
    const content: ExtractedContent = {
      title: undefined as unknown as string,
      paragraphs: ['Some content.'],
      text: 'Some content.',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text.startsWith('Extracted Content\n\n')).toBe(true);
  });

  it('should filter out empty paragraphs', async () => {
    const content: ExtractedContent = {
      title: 'Title',
      paragraphs: ['Valid 1', '', '   ', 'Valid 2', ''],
      text: 'Valid 1\n\nValid 2',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).toBe('Title\n\nValid 1\n\nValid 2');
    expect(text).not.toContain('\n\n\n'); // No triple newlines from empty paragraphs
  });

  it('should handle single paragraph without trailing newlines', async () => {
    const content: ExtractedContent = {
      title: 'Title',
      paragraphs: ['Only paragraph.'],
      text: 'Only paragraph.',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).toBe('Title\n\nOnly paragraph.');
    expect(text.endsWith('\n')).toBe(false);
  });

  it('should handle empty paragraphs array', async () => {
    const content: ExtractedContent = {
      title: 'Title Only',
      paragraphs: [],
      text: '',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).toBe('Title Only');
  });

  it('should normalize Windows line endings (\\r\\n)', async () => {
    const content: ExtractedContent = {
      title: 'Title',
      paragraphs: ['Line 1\r\nLine 2'],
      text: 'Line 1\r\nLine 2',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).not.toContain('\r');
    expect(text).toContain('Line 1\nLine 2');
  });

  it('should normalize old Mac line endings (\\r)', async () => {
    const content: ExtractedContent = {
      title: 'Title',
      paragraphs: ['Line 1\rLine 2'],
      text: 'Line 1\rLine 2',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).not.toContain('\r');
    expect(text).toContain('Line 1\nLine 2');
  });

  it('should handle mixed line endings', async () => {
    const content: ExtractedContent = {
      title: 'Title',
      paragraphs: ['A\r\nB\rC\nD'],
      text: 'A\r\nB\rC\nD',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).not.toContain('\r');
    expect(text).toContain('A\nB\nC\nD');
  });

  it('should preserve UTF-8 characters', async () => {
    const content: ExtractedContent = {
      title: 'UTF-8 Test: é à ü ñ',
      paragraphs: [
        'Accented: café résumé naïve',
        'Asian: 中文 日本語 한국어',
        'Emoji: 🎉 🚀 ✨',
        'Symbols: © ® ™ € £ ¥',
      ],
      text: 'UTF-8 content',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    expect(text).toContain('café');
    expect(text).toContain('中文');
    expect(text).toContain('🎉');
    expect(text).toContain('©');
  });

  it('should handle special characters without HTML encoding', async () => {
    const content: ExtractedContent = {
      title: 'Special Chars',
      paragraphs: ['Math: < > & " \' = + - * /'],
      text: 'Math: < > & " \' = + - * /',
    };

    const blob = createTextFile(content);
    const text = await blob.text();

    // Should be plain text, not HTML entities
    expect(text).toContain('< > &');
    expect(text).not.toContain('&lt;');
    expect(text).not.toContain('&gt;');
    expect(text).not.toContain('&amp;');
  });

  it('should return synchronously (not async)', () => {
    const content: ExtractedContent = {
      title: 'Test',
      paragraphs: ['Content.'],
      text: 'Content.',
    };

    // createTextFile is synchronous, unlike createDocument
    const result = createTextFile(content);
    expect(result).toBeInstanceOf(Blob);
  });
});

describe('TXT_MIME_TYPE', () => {
  it('should be correct MIME type for UTF-8 text files', () => {
    expect(TXT_MIME_TYPE).toBe('text/plain;charset=utf-8');
  });
});

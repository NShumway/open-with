import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  hasMainContent,
  getContentPreview,
  getPageTitle,
  getMainContentElement,
  extractMainContent,
} from './text';

// Setup JSDOM environment before each test
function setupDOM(html: string, title: string = 'Test Page'): void {
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.HTMLElement = dom.window.HTMLElement;

  // Set document title
  dom.window.document.title = title;
}

describe('getPageTitle', () => {
  it('should return document title', () => {
    setupDOM('<div>Content</div>', 'My Test Page');
    expect(getPageTitle()).toBe('My Test Page');
  });

  it('should return empty string if no title', () => {
    setupDOM('<div>Content</div>', '');
    expect(getPageTitle()).toBe('');
  });
});

describe('hasMainContent', () => {
  it('should return true for page with <article> tag and content', () => {
    const longText = 'This is a paragraph of meaningful content. '.repeat(10);
    setupDOM(`
      <article>
        <h1>Article Title</h1>
        <p>${longText}</p>
      </article>
    `);
    expect(hasMainContent()).toBe(true);
  });

  it('should return true for page with <main> tag and content', () => {
    const longText = 'Main content area with lots of text. '.repeat(10);
    setupDOM(`
      <main>
        <p>${longText}</p>
      </main>
    `);
    expect(hasMainContent()).toBe(true);
  });

  it('should return true for page with role="main"', () => {
    const longText = 'Content inside main role element. '.repeat(10);
    setupDOM(`
      <div role="main">
        <p>${longText}</p>
      </div>
    `);
    expect(hasMainContent()).toBe(true);
  });

  it('should return false for page with only navigation', () => {
    setupDOM(`
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    `);
    expect(hasMainContent()).toBe(false);
  });

  it('should return false for page with minimal content', () => {
    setupDOM(`
      <div>
        <p>Short text.</p>
      </div>
    `);
    expect(hasMainContent()).toBe(false);
  });

  it('should return true for common content class patterns', () => {
    const longText = 'Article content with meaningful text. '.repeat(10);
    setupDOM(`
      <div class="article-content">
        <p>${longText}</p>
      </div>
    `);
    expect(hasMainContent()).toBe(true);
  });

  it('should return true for #content id pattern', () => {
    const longText = 'Main content section with paragraphs. '.repeat(10);
    setupDOM(`
      <div id="content">
        <p>${longText}</p>
      </div>
    `);
    expect(hasMainContent()).toBe(true);
  });

  it('should find content based on paragraph density', () => {
    const longText = 'This is paragraph content. '.repeat(5);
    setupDOM(`
      <div>
        <div class="sidebar">
          <p>Short sidebar text</p>
        </div>
        <div class="main-area">
          <p>${longText}</p>
          <p>${longText}</p>
          <p>${longText}</p>
        </div>
      </div>
    `);
    expect(hasMainContent()).toBe(true);
  });

  it('should exclude elements with nav/menu classes', () => {
    const longText = 'This would be long enough content. '.repeat(10);
    setupDOM(`
      <div class="nav-content">
        <p>${longText}</p>
      </div>
    `);
    expect(hasMainContent()).toBe(false);
  });

  it('should exclude elements with footer id', () => {
    const longText = 'Footer content that is long enough. '.repeat(10);
    setupDOM(`
      <div id="footer-section">
        <p>${longText}</p>
      </div>
    `);
    expect(hasMainContent()).toBe(false);
  });
});

describe('getContentPreview', () => {
  it('should return first paragraph text', () => {
    const paragraph1 = 'This is the first paragraph with some meaningful content that is long enough to be detected.';
    const paragraph2 = 'This is the second paragraph with additional content to ensure we meet the minimum threshold.';
    setupDOM(`
      <article>
        <p>${paragraph1}</p>
        <p>${paragraph2}</p>
      </article>
    `);
    const preview = getContentPreview();
    expect(preview).toBe(paragraph1);
  });

  it('should truncate long text at word boundary', () => {
    const longText = 'Word '.repeat(100);
    setupDOM(`
      <article>
        <p>${longText}</p>
      </article>
    `);
    const preview = getContentPreview(50);
    expect(preview.length).toBeLessThanOrEqual(53); // 50 + '...'
    expect(preview.endsWith('...')).toBe(true);
    // Should not end with partial word
    expect(preview.match(/Word\.\.\.$/)).toBeTruthy();
  });

  it('should return empty string for pages with no content', () => {
    setupDOM(`
      <nav>
        <ul><li>Link</li></ul>
      </nav>
    `);
    const preview = getContentPreview();
    expect(preview).toBe('');
  });

  it('should respect maxLength parameter', () => {
    const longText = 'A'.repeat(500);
    setupDOM(`
      <article>
        <p>${longText}</p>
      </article>
    `);
    const preview = getContentPreview(100);
    expect(preview.length).toBeLessThanOrEqual(103); // 100 + '...'
  });

  it('should clean up excessive whitespace', () => {
    const padding = ' More content here to ensure we meet the minimum threshold for detection.';
    setupDOM(`
      <article>
        <p>Text   with    lots     of      whitespace.${padding}</p>
      </article>
    `);
    const preview = getContentPreview();
    expect(preview.startsWith('Text with lots of whitespace.')).toBe(true);
  });

  it('should fall back to element text if no paragraph', () => {
    const text = 'This is content without paragraph tags but still meaningful enough to be detected as main content area.';
    setupDOM(`
      <article>
        <div>${text}</div>
      </article>
    `);
    const preview = getContentPreview();
    expect(preview).toBe(text);
  });

  it('should not truncate short content under maxLength', () => {
    // Content must be >100 chars to be detected, but <200 to not be truncated
    const text = 'This is a moderately long sentence that has enough content to be detected but not so long that it needs truncation.';
    setupDOM(`
      <article>
        <p>${text}</p>
      </article>
    `);
    const preview = getContentPreview(200);
    expect(preview).toBe(text);
    expect(preview.endsWith('...')).toBe(false);
  });
});

describe('getMainContentElement', () => {
  it('should return article element when present', () => {
    const longText = 'Content inside article tag. '.repeat(10);
    setupDOM(`
      <article id="main-article">
        <p>${longText}</p>
      </article>
    `);
    const element = getMainContentElement();
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe('ARTICLE');
  });

  it('should return main element when present', () => {
    const longText = 'Content inside main tag. '.repeat(10);
    setupDOM(`
      <main id="main-content">
        <p>${longText}</p>
      </main>
    `);
    const element = getMainContentElement();
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe('MAIN');
  });

  it('should return null when no content found', () => {
    setupDOM(`
      <nav>
        <a href="/">Home</a>
      </nav>
    `);
    const element = getMainContentElement();
    expect(element).toBeNull();
  });

  it('should prefer semantic elements over class patterns', () => {
    const longText = 'Content text here. '.repeat(10);
    setupDOM(`
      <div class="article-content">
        <p>${longText}</p>
      </div>
      <article>
        <p>${longText}</p>
      </article>
    `);
    const element = getMainContentElement();
    expect(element?.tagName).toBe('ARTICLE');
  });
});

describe('performance', () => {
  it('hasMainContent should execute quickly on complex page', () => {
    // Generate a complex page with many elements
    const sections = Array(100)
      .fill(null)
      .map(
        (_, i) => `
      <div class="section-${i}">
        <p>Paragraph ${i} with some content.</p>
        <ul><li>Item 1</li><li>Item 2</li></ul>
      </div>
    `
      )
      .join('');

    const longText = 'Main article content here. '.repeat(50);
    setupDOM(`
      <nav><a href="/">Home</a></nav>
      ${sections}
      <article>
        <p>${longText}</p>
      </article>
      <footer>Footer content</footer>
    `);

    const start = performance.now();
    const result = hasMainContent();
    const duration = performance.now() - start;

    expect(result).toBe(true);
    expect(duration).toBeLessThan(50); // Should complete in <50ms
  });
});

describe('extractMainContent', () => {
  it('should extract paragraphs from article element', () => {
    setupDOM(`
      <article>
        <h1>Article Title Heading</h1>
        <p>First paragraph with enough content to pass the minimum length threshold for extraction.</p>
        <p>Second paragraph with more meaningful content that should be extracted as well.</p>
        <p>Third paragraph completes the article with additional information here.</p>
      </article>
    `, 'My Test Article');

    const result = extractMainContent();

    expect(result.title).toBe('My Test Article');
    expect(result.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(result.paragraphs[0]).toContain('Article Title');
    expect(result.text).toContain('First paragraph');
    expect(result.text).toContain('Second paragraph');
  });

  it('should exclude sidebar and footer content', () => {
    setupDOM(`
      <div class="page">
        <aside class="sidebar">
          <p>Sidebar content that should not be extracted because it is not main content.</p>
        </aside>
        <article>
          <p>Main article content that should be extracted. This is the primary content.</p>
          <p>More main content paragraphs that belong to the article body text.</p>
        </article>
        <footer>
          <p>Footer content that should not be extracted because it is navigation.</p>
        </footer>
      </div>
    `);

    const result = extractMainContent();

    expect(result.text).toContain('Main article content');
    expect(result.text).not.toContain('Sidebar content');
    expect(result.text).not.toContain('Footer content');
  });

  it('should filter out short paragraphs', () => {
    setupDOM(`
      <article>
        <p>Too short</p>
        <p>This paragraph has enough content to be included in the extraction results.</p>
        <p>X</p>
        <p>Another valid paragraph with sufficient length to pass the threshold filter.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.paragraphs).not.toContain('Too short');
    expect(result.paragraphs).not.toContain('X');
    expect(result.paragraphs.length).toBe(2);
  });

  it('should preserve paragraph structure with double newlines', () => {
    setupDOM(`
      <article>
        <p>First paragraph that is long enough to be extracted as content text.</p>
        <p>Second paragraph that is also long enough to be extracted properly.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.text).toContain('\n\n');
    const parts = result.text.split('\n\n');
    expect(parts.length).toBe(2);
  });

  it('should extract headings as separate paragraphs', () => {
    setupDOM(`
      <article>
        <h1>Main Article Heading Title</h1>
        <p>Content paragraph that follows the heading with details.</p>
        <h2>Section Subheading Title</h2>
        <p>More content in the section following the subheading text.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.paragraphs.some(p => p.includes('Main Article Heading'))).toBe(true);
    expect(result.paragraphs.some(p => p.includes('Section Subheading'))).toBe(true);
  });

  it('should extract list items', () => {
    setupDOM(`
      <article>
        <p>Introduction paragraph with enough length to be extracted from page.</p>
        <ul>
          <li>First list item with enough content to pass the filter threshold.</li>
          <li>Second list item with additional text content for extraction.</li>
        </ul>
      </article>
    `);

    const result = extractMainContent();

    expect(result.text).toContain('First list item');
    expect(result.text).toContain('Second list item');
  });

  it('should extract blockquotes', () => {
    setupDOM(`
      <article>
        <p>Introduction paragraph before the quote with enough content length.</p>
        <blockquote>This is a quoted passage with enough text to pass the minimum length.</blockquote>
        <p>Conclusion paragraph after the quote with additional content here.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.text).toContain('quoted passage');
  });

  it('should normalize whitespace in extracted content', () => {
    setupDOM(`
      <article>
        <p>Paragraph   with    multiple     spaces    that should be normalized.</p>
        <p>Another
        paragraph
        with
        newlines.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.paragraphs[0]).not.toContain('  ');
    expect(result.paragraphs[1]).not.toContain('\n');
  });

  it('should return empty result for pages with no content', () => {
    setupDOM(`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    `);

    const result = extractMainContent();

    expect(result.paragraphs).toHaveLength(0);
    expect(result.text).toBe('');
  });

  it('should deduplicate identical paragraphs', () => {
    setupDOM(`
      <article>
        <p>Duplicate paragraph content that appears multiple times in the article.</p>
        <p>Duplicate paragraph content that appears multiple times in the article.</p>
        <p>Unique paragraph that is different from the duplicated content above.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.paragraphs.length).toBe(2);
  });

  it('should handle pages with high link density by scoring lower', () => {
    setupDOM(`
      <div class="links-only">
        <p><a href="#">Link 1</a> <a href="#">Link 2</a> <a href="#">Link 3</a> <a href="#">Link 4</a></p>
        <p><a href="#">Link 5</a> <a href="#">Link 6</a> <a href="#">Link 7</a> <a href="#">Link 8</a></p>
      </div>
      <article>
        <p>Actual content paragraph without many links that should be preferred by algorithm.</p>
        <p>Another paragraph with real content that does not have excessive linking.</p>
      </article>
    `);

    const result = extractMainContent();

    expect(result.text).toContain('Actual content');
  });
});

describe('extractMainContent performance', () => {
  it('should extract complex article in <3s', () => {
    // Generate complex article
    const paragraphs = Array(100)
      .fill(null)
      .map((_, i) => `<p>Paragraph ${i} with meaningful content that simulates real article text. This is enough text to pass the minimum threshold for extraction and filtering.</p>`)
      .join('');

    setupDOM(`
      <nav><a href="/">Home</a></nav>
      <article>
        <h1>Complex Article Title</h1>
        ${paragraphs}
      </article>
      <footer>Footer</footer>
    `, 'Complex Article');

    const start = performance.now();
    const result = extractMainContent();
    const duration = performance.now() - start;

    expect(result.paragraphs.length).toBeGreaterThan(50);
    expect(duration).toBeLessThan(3000);
  });
});

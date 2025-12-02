import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  discoverTables,
  getTableName,
  getTablePreview,
  discoverTablesWithElements,
  getDiscoveredTableElements,
  discoverContent,
} from './discovery';

// Setup JSDOM environment before each test
function setupDOM(html: string, title: string = 'Test Page'): void {
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.HTMLElement = dom.window.HTMLElement;
  dom.window.document.title = title;
}

describe('getTableName', () => {
  it('should use caption element text', () => {
    setupDOM(`
      <table id="test">
        <caption>Monthly Sales Report</caption>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('Monthly Sales Report');
  });

  it('should use aria-label when no caption', () => {
    setupDOM(`
      <table aria-label="User Statistics">
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('User Statistics');
  });

  it('should use aria-describedby referenced element', () => {
    setupDOM(`
      <p id="table-desc">Revenue by Quarter</p>
      <table aria-describedby="table-desc">
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('Revenue by Quarter');
  });

  it('should use preceding heading within 3 siblings', () => {
    setupDOM(`
      <h2>Employee Directory</h2>
      <p>Some intro text</p>
      <table>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('Employee Directory');
  });

  it('should not use heading more than 3 siblings away', () => {
    setupDOM(`
      <h2>Far Away Heading</h2>
      <p>Text 1</p>
      <p>Text 2</p>
      <p>Text 3</p>
      <p>Text 4</p>
      <table>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('Table 1');
  });

  it('should use cleaned id attribute', () => {
    setupDOM(`
      <table id="sales-data-2024">
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('sales data 2024');
  });

  it('should fallback to Table N', () => {
    setupDOM(`
      <table>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 2)).toBe('Table 3');
  });

  it('should truncate long names', () => {
    const longCaption = 'A'.repeat(150);
    setupDOM(`
      <table>
        <caption>${longCaption}</caption>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const name = getTableName(table, 0);
    expect(name.length).toBe(100);
    expect(name.endsWith('...')).toBe(true);
  });

  it('should prefer caption over aria-label', () => {
    setupDOM(`
      <table aria-label="Aria Name">
        <caption>Caption Name</caption>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(getTableName(table, 0)).toBe('Caption Name');
  });
});

describe('getTablePreview', () => {
  it('should return first 3 rows by default', () => {
    setupDOM(`
      <table>
        <tr><td>R1C1</td><td>R1C2</td></tr>
        <tr><td>R2C1</td><td>R2C2</td></tr>
        <tr><td>R3C1</td><td>R3C2</td></tr>
        <tr><td>R4C1</td><td>R4C2</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const preview = getTablePreview(table);
    expect(preview).toHaveLength(3);
    expect(preview[0]).toEqual(['R1C1', 'R1C2']);
    expect(preview[2]).toEqual(['R3C1', 'R3C2']);
  });

  it('should handle tables with fewer rows', () => {
    setupDOM(`
      <table>
        <tr><td>Only</td><td>Row</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const preview = getTablePreview(table);
    expect(preview).toHaveLength(1);
  });

  it('should truncate long cell content', () => {
    const longText = 'X'.repeat(100);
    setupDOM(`
      <table>
        <tr><td>${longText}</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const preview = getTablePreview(table);
    expect(preview[0][0].length).toBe(50);
    expect(preview[0][0].endsWith('...')).toBe(true);
  });

  it('should handle th and td elements', () => {
    setupDOM(`
      <table>
        <tr><th>Header 1</th><th>Header 2</th></tr>
        <tr><td>Data 1</td><td>Data 2</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const preview = getTablePreview(table);
    expect(preview[0]).toEqual(['Header 1', 'Header 2']);
    expect(preview[1]).toEqual(['Data 1', 'Data 2']);
  });

  it('should allow custom maxRows', () => {
    setupDOM(`
      <table>
        <tr><td>R1</td></tr>
        <tr><td>R2</td></tr>
        <tr><td>R3</td></tr>
        <tr><td>R4</td></tr>
        <tr><td>R5</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const preview = getTablePreview(table, 5);
    expect(preview).toHaveLength(5);
  });
});

describe('discoverTables', () => {
  it('should discover semantic data tables', () => {
    setupDOM(`
      <table>
        <caption>Data Table</caption>
        <tr><th>Col1</th><th>Col2</th></tr>
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('Data Table');
    expect(tables[0].rowCount).toBe(3);
    expect(tables[0].columnCount).toBe(2);
  });

  it('should filter out single-row tables', () => {
    setupDOM(`
      <table>
        <tr><td>Only one row</td><td>Layout</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(0);
  });

  it('should filter out single-column tables', () => {
    setupDOM(`
      <table>
        <tr><td>Row 1</td></tr>
        <tr><td>Row 2</td></tr>
        <tr><td>Row 3</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(0);
  });

  it('should filter out tables with role="presentation"', () => {
    setupDOM(`
      <table role="presentation">
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(0);
  });

  it('should filter out tables with role="none"', () => {
    setupDOM(`
      <table role="none">
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(0);
  });

  it('should filter out nested tables', () => {
    setupDOM(`
      <table>
        <tr>
          <td>
            <table>
              <tr><td>Nested A</td><td>Nested B</td></tr>
              <tr><td>Nested C</td><td>Nested D</td></tr>
            </table>
          </td>
          <td>Outer</td>
        </tr>
        <tr><td>Row 2</td><td>Data</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(1);
    // Should only find the outer table
    expect(tables[0].previewRows[0]).toContain('Outer');
  });

  it('should discover multiple tables', () => {
    setupDOM(`
      <h2>First Table</h2>
      <table>
        <tr><td>A1</td><td>B1</td></tr>
        <tr><td>A2</td><td>B2</td></tr>
      </table>
      <h2>Second Table</h2>
      <table>
        <tr><td>X1</td><td>Y1</td></tr>
        <tr><td>X2</td><td>Y2</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(2);
    expect(tables[0].name).toBe('First Table');
    expect(tables[1].name).toBe('Second Table');
    expect(tables[0].index).toBe(0);
    expect(tables[1].index).toBe(1);
  });

  it('should include preview rows in result', () => {
    setupDOM(`
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Item 1</td><td>100</td></tr>
        <tr><td>Item 2</td><td>200</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables[0].previewRows).toHaveLength(3);
    expect(tables[0].previewRows[0]).toEqual(['Name', 'Value']);
  });

  it('should handle empty tables gracefully', () => {
    setupDOM(`
      <table></table>
      <table>
        <tr><td>Valid</td><td>Table</td></tr>
        <tr><td>With</td><td>Data</td></tr>
      </table>
    `);
    const tables = discoverTables();
    expect(tables).toHaveLength(1);
  });
});

describe('discoverTablesWithElements', () => {
  it('should cache table elements for later extraction', () => {
    setupDOM(`
      <table id="table1">
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
      <table id="table2">
        <tr><td>X</td><td>Y</td></tr>
        <tr><td>Z</td><td>W</td></tr>
      </table>
    `);
    const tables = discoverTablesWithElements();
    const elements = getDiscoveredTableElements();

    expect(tables).toHaveLength(2);
    expect(elements).toHaveLength(2);
    expect(elements[0].id).toBe('table1');
    expect(elements[1].id).toBe('table2');
  });

  it('should return same results as discoverTables', () => {
    setupDOM(`
      <table>
        <caption>Test Table</caption>
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);
    const withElements = discoverTablesWithElements();
    // Reset DOM and discover again
    setupDOM(`
      <table>
        <caption>Test Table</caption>
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);
    const withoutElements = discoverTables();

    expect(withElements).toHaveLength(withoutElements.length);
    expect(withElements[0].name).toBe(withoutElements[0].name);
  });
});

describe('discoverContent', () => {
  it('should discover tables and text content together', () => {
    const longText = 'This is a long article with meaningful content. '.repeat(10);
    setupDOM(`
      <article>
        <h1>Page Title</h1>
        <p>${longText}</p>
      </article>
      <table>
        <caption>Data Table</caption>
        <tr><th>A</th><th>B</th></tr>
        <tr><td>1</td><td>2</td></tr>
      </table>
    `, 'Test Page Title');

    const result = discoverContent();

    expect(result.pageTitle).toBe('Test Page Title');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('Data Table');
    expect(result.hasMainContent).toBe(true);
    expect(result.contentPreview.length).toBeGreaterThan(0);
    expect(result.contentPreview.length).toBeLessThanOrEqual(203); // 200 + '...'
  });

  it('should return tables only when no main content', () => {
    setupDOM(`
      <nav>
        <ul><li>Link 1</li><li>Link 2</li></ul>
      </nav>
      <table>
        <tr><td>Data</td><td>Table</td></tr>
        <tr><td>Row</td><td>Two</td></tr>
      </table>
    `);

    const result = discoverContent();

    expect(result.tables).toHaveLength(1);
    expect(result.hasMainContent).toBe(false);
    expect(result.contentPreview).toBe('');
  });

  it('should return text content when no tables', () => {
    const longText = 'Article content that is long enough to be detected. '.repeat(5);
    setupDOM(`
      <article>
        <p>${longText}</p>
      </article>
    `);

    const result = discoverContent();

    expect(result.tables).toHaveLength(0);
    expect(result.hasMainContent).toBe(true);
    expect(result.contentPreview.length).toBeGreaterThan(0);
  });

  it('should return empty result for minimal pages', () => {
    setupDOM(`
      <nav>
        <a href="/">Home</a>
      </nav>
    `);

    const result = discoverContent();

    expect(result.tables).toHaveLength(0);
    expect(result.hasMainContent).toBe(false);
    expect(result.contentPreview).toBe('');
    expect(result.pageTitle).toBe('Test Page');
  });

  it('should include page title', () => {
    setupDOM('<div>Content</div>', 'My Custom Page Title');

    const result = discoverContent();

    expect(result.pageTitle).toBe('My Custom Page Title');
  });

  it('should execute quickly on complex pages', () => {
    // Generate complex page
    const sections = Array(50)
      .fill(null)
      .map((_, i) => `<div class="section-${i}"><p>Content ${i}</p></div>`)
      .join('');
    const tables = Array(10)
      .fill(null)
      .map((_, i) => `
        <table id="table-${i}">
          <tr><td>Row 1</td><td>Col 2</td></tr>
          <tr><td>Row 2</td><td>Col 2</td></tr>
        </table>
      `)
      .join('');
    const longText = 'Main article content here. '.repeat(50);

    setupDOM(`
      <nav><a href="/">Home</a></nav>
      ${sections}
      <article><p>${longText}</p></article>
      ${tables}
      <footer>Footer</footer>
    `);

    const start = performance.now();
    const result = discoverContent();
    const duration = performance.now() - start;

    expect(result.tables).toHaveLength(10);
    expect(result.hasMainContent).toBe(true);
    expect(duration).toBeLessThan(500); // Should complete in <500ms
  });
});

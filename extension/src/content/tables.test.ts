import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractTable, detectHeader, extractAllTables } from './tables';
import { discoverTablesWithElements } from './discovery';

// Setup JSDOM environment before each test
function setupDOM(html: string): void {
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.HTMLElement = dom.window.HTMLElement;
}

describe('detectHeader', () => {
  it('should detect thead as header', () => {
    setupDOM(`
      <table>
        <thead>
          <tr><th>A</th><th>B</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>2</td></tr>
        </tbody>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(detectHeader(table)).toBe(true);
  });

  it('should detect >50% th elements in first row as header', () => {
    setupDOM(`
      <table>
        <tr><th>Header 1</th><th>Header 2</th><td>Data</td></tr>
        <tr><td>A</td><td>B</td><td>C</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(detectHeader(table)).toBe(true);
  });

  it('should not detect header when first row has <=50% th', () => {
    setupDOM(`
      <table>
        <tr><th>Header</th><td>Data 1</td><td>Data 2</td><td>Data 3</td></tr>
        <tr><td>A</td><td>B</td><td>C</td><td>D</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(detectHeader(table)).toBe(false);
  });

  it('should not detect header when all cells are td', () => {
    setupDOM(`
      <table>
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(detectHeader(table)).toBe(false);
  });

  it('should handle empty table', () => {
    setupDOM(`<table></table>`);
    const table = document.querySelector('table') as HTMLTableElement;
    expect(detectHeader(table)).toBe(false);
  });
});

describe('extractTable', () => {
  it('should extract simple table data', () => {
    setupDOM(`
      <table>
        <tr><td>A1</td><td>B1</td></tr>
        <tr><td>A2</td><td>B2</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]);
    expect(result.hasHeader).toBe(false);
  });

  it('should extract table with header row', () => {
    setupDOM(`
      <table>
        <thead>
          <tr><th>Name</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>Item 1</td><td>100</td></tr>
          <tr><td>Item 2</td><td>200</td></tr>
        </tbody>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['Name', 'Value'],
      ['Item 1', '100'],
      ['Item 2', '200'],
    ]);
    expect(result.hasHeader).toBe(true);
  });

  it('should handle colspan by duplicating values', () => {
    setupDOM(`
      <table>
        <tr><th colspan="3">Wide Header</th></tr>
        <tr><td>A</td><td>B</td><td>C</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['Wide Header', 'Wide Header', 'Wide Header'],
      ['A', 'B', 'C'],
    ]);
  });

  it('should handle rowspan by duplicating values', () => {
    setupDOM(`
      <table>
        <tr><td rowspan="2">Merged</td><td>B1</td></tr>
        <tr><td>B2</td></tr>
        <tr><td>A3</td><td>B3</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['Merged', 'B1'],
      ['Merged', 'B2'],
      ['A3', 'B3'],
    ]);
  });

  it('should handle combined colspan and rowspan', () => {
    setupDOM(`
      <table>
        <tr><td colspan="2" rowspan="2">Big Cell</td><td>C1</td></tr>
        <tr><td>C2</td></tr>
        <tr><td>A3</td><td>B3</td><td>C3</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['Big Cell', 'Big Cell', 'C1'],
      ['Big Cell', 'Big Cell', 'C2'],
      ['A3', 'B3', 'C3'],
    ]);
  });

  it('should handle empty cells', () => {
    setupDOM(`
      <table>
        <tr><td>A</td><td></td><td>C</td></tr>
        <tr><td></td><td>B</td><td></td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['A', '', 'C'],
      ['', 'B', ''],
    ]);
  });

  it('should extract image alt text when cell has no text', () => {
    setupDOM(`
      <table>
        <tr><td><img src="test.png" alt="Test Image"></td><td>Text</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data[0][0]).toBe('Test Image');
    expect(result.data[0][1]).toBe('Text');
  });

  it('should normalize whitespace in cell content', () => {
    setupDOM(`
      <table>
        <tr><td>  Multiple   spaces  </td><td>
          Newlines
          here
        </td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data[0][0]).toBe('Multiple spaces');
    expect(result.data[0][1]).toBe('Newlines here');
  });

  it('should use table name from getTableName', () => {
    setupDOM(`
      <table>
        <caption>My Table</caption>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.name).toBe('My Table');
  });

  it('should handle complex real-world table with multiple rowspans', () => {
    setupDOM(`
      <table>
        <tr>
          <th>Category</th>
          <th>Item</th>
          <th>Value</th>
        </tr>
        <tr>
          <td rowspan="2">Fruits</td>
          <td>Apple</td>
          <td>$1.00</td>
        </tr>
        <tr>
          <td>Banana</td>
          <td>$0.50</td>
        </tr>
        <tr>
          <td rowspan="2">Vegetables</td>
          <td>Carrot</td>
          <td>$0.75</td>
        </tr>
        <tr>
          <td>Potato</td>
          <td>$0.60</td>
        </tr>
      </table>
    `);
    const table = document.querySelector('table') as HTMLTableElement;
    const result = extractTable(table, 0);

    expect(result.data).toEqual([
      ['Category', 'Item', 'Value'],
      ['Fruits', 'Apple', '$1.00'],
      ['Fruits', 'Banana', '$0.50'],
      ['Vegetables', 'Carrot', '$0.75'],
      ['Vegetables', 'Potato', '$0.60'],
    ]);
  });
});

describe('extractAllTables', () => {
  it('should extract all discovered tables', () => {
    setupDOM(`
      <table id="table1">
        <tr><td>T1-A</td><td>T1-B</td></tr>
        <tr><td>T1-C</td><td>T1-D</td></tr>
      </table>
      <table id="table2">
        <tr><td>T2-A</td><td>T2-B</td></tr>
        <tr><td>T2-C</td><td>T2-D</td></tr>
      </table>
    `);

    // First run discovery to cache elements
    discoverTablesWithElements();

    // Then extract all
    const results = extractAllTables();

    expect(results).toHaveLength(2);
    expect(results[0].data).toEqual([
      ['T1-A', 'T1-B'],
      ['T1-C', 'T1-D'],
    ]);
    expect(results[1].data).toEqual([
      ['T2-A', 'T2-B'],
      ['T2-C', 'T2-D'],
    ]);
  });

  it('should skip empty tables', () => {
    setupDOM(`
      <table id="empty"></table>
      <table id="valid">
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C</td><td>D</td></tr>
      </table>
    `);

    discoverTablesWithElements();
    const results = extractAllTables();

    expect(results).toHaveLength(1);
    expect(results[0].data).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });
});

describe('performance', () => {
  it('should extract 1000 row table in <2s', () => {
    // Generate large table HTML
    const rows = Array(1000)
      .fill(null)
      .map((_, i) => `<tr><td>Row ${i}</td><td>Value ${i}</td><td>Extra ${i}</td></tr>`)
      .join('');
    setupDOM(`<table><thead><tr><th>ID</th><th>Value</th><th>Extra</th></tr></thead><tbody>${rows}</tbody></table>`);

    const table = document.querySelector('table') as HTMLTableElement;

    const start = performance.now();
    const result = extractTable(table, 0);
    const duration = performance.now() - start;

    expect(result.data).toHaveLength(1001); // Header + 1000 rows
    expect(result.data[0]).toEqual(['ID', 'Value', 'Extra']);
    expect(result.hasHeader).toBe(true);
    expect(duration).toBeLessThan(2000);
  });
});

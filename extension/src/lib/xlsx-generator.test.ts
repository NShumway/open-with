import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { createWorkbook, XLSX_MIME_TYPE } from './xlsx-generator';
import type { TableData } from '../types/extraction';

describe('createWorkbook', () => {
  it('should create a valid XLSX blob from single table', () => {
    const tables: TableData[] = [
      {
        name: 'Test Table',
        data: [
          ['Header 1', 'Header 2'],
          ['Value A', 'Value B'],
          ['Value C', 'Value D'],
        ],
        hasHeader: true,
      },
    ];

    const blob = createWorkbook(tables);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(XLSX_MIME_TYPE);
  });

  it('should create multi-sheet workbook from multiple tables', async () => {
    const tables: TableData[] = [
      {
        name: 'Sales Data',
        data: [
          ['Month', 'Revenue'],
          ['Jan', '1000'],
          ['Feb', '1200'],
        ],
        hasHeader: true,
      },
      {
        name: 'Customer Data',
        data: [
          ['Name', 'Email'],
          ['Alice', 'alice@example.com'],
          ['Bob', 'bob@example.com'],
        ],
        hasHeader: true,
      },
      {
        name: 'Product Data',
        data: [
          ['Product', 'Price'],
          ['Widget', '9.99'],
          ['Gadget', '19.99'],
        ],
        hasHeader: true,
      },
    ];

    const blob = createWorkbook(tables);

    // Read blob back into workbook to verify structure
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    expect(workbook.SheetNames).toHaveLength(3);
    expect(workbook.SheetNames).toContain('Sales Data');
    expect(workbook.SheetNames).toContain('Customer Data');
    expect(workbook.SheetNames).toContain('Product Data');
  });

  it('should sanitize invalid characters in sheet names', async () => {
    const tables: TableData[] = [
      {
        name: 'Test [Special] / Characters: *?',
        data: [['A', 'B'], ['1', '2']],
        hasHeader: false,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    // Check that invalid chars were removed
    const sheetName = workbook.SheetNames[0];
    expect(sheetName).not.toContain('[');
    expect(sheetName).not.toContain(']');
    expect(sheetName).not.toContain('/');
    expect(sheetName).not.toContain(':');
    expect(sheetName).not.toContain('*');
    expect(sheetName).not.toContain('?');
  });

  it('should truncate long sheet names to 31 characters', async () => {
    const longName = 'This is a very long table name that exceeds the Excel limit';
    const tables: TableData[] = [
      {
        name: longName,
        data: [['A', 'B'], ['1', '2']],
        hasHeader: false,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    expect(workbook.SheetNames[0].length).toBeLessThanOrEqual(31);
  });

  it('should deduplicate sheet names', async () => {
    const tables: TableData[] = [
      {
        name: 'Summary',
        data: [['A'], ['1']],
        hasHeader: false,
      },
      {
        name: 'Summary',
        data: [['B'], ['2']],
        hasHeader: false,
      },
      {
        name: 'Summary',
        data: [['C'], ['3']],
        hasHeader: false,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    expect(workbook.SheetNames).toHaveLength(3);
    expect(workbook.SheetNames[0]).toBe('Summary');
    expect(workbook.SheetNames[1]).toBe('Summary 2');
    expect(workbook.SheetNames[2]).toBe('Summary 3');
  });

  it('should skip empty tables', async () => {
    const tables: TableData[] = [
      {
        name: 'Empty Table',
        data: [],
        hasHeader: false,
      },
      {
        name: 'Valid Table',
        data: [['A', 'B'], ['1', '2']],
        hasHeader: false,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    expect(workbook.SheetNames).toHaveLength(1);
    expect(workbook.SheetNames[0]).toBe('Valid Table');
  });

  it('should create placeholder sheet when all tables are empty', async () => {
    const tables: TableData[] = [];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    expect(workbook.SheetNames).toHaveLength(1);
    expect(workbook.SheetNames[0]).toBe('Sheet1');
  });

  it('should preserve data accurately', async () => {
    const tables: TableData[] = [
      {
        name: 'Test Data',
        data: [
          ['Name', 'Age', 'City'],
          ['Alice', '30', 'New York'],
          ['Bob', '25', 'Los Angeles'],
          ['Charlie', '35', 'Chicago'],
        ],
        hasHeader: true,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheet = workbook.Sheets['Test Data'];
    const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    expect(json).toHaveLength(4);
    expect(json[0]).toEqual(['Name', 'Age', 'City']);
    expect(json[1]).toEqual(['Alice', '30', 'New York']);
    expect(json[2]).toEqual(['Bob', '25', 'Los Angeles']);
    expect(json[3]).toEqual(['Charlie', '35', 'Chicago']);
  });

  it('should handle tables with special characters in data', async () => {
    const tables: TableData[] = [
      {
        name: 'Special Chars',
        data: [
          ['Formula', 'Symbol'],
          ['=SUM(A1:A10)', '< > & " \''],
          ['Unicode: \u00e9\u00e0\u00fc', '\u4e2d\u6587'],
        ],
        hasHeader: true,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheet = workbook.Sheets['Special Chars'];
    const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    expect(json[1][0]).toBe('=SUM(A1:A10)');
    expect(json[2][0]).toContain('\u00e9');
  });

  it('should handle table with only name fallback', async () => {
    const tables: TableData[] = [
      {
        name: '',
        data: [['A', 'B'], ['1', '2']],
        hasHeader: false,
      },
    ];

    const blob = createWorkbook(tables);
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    // Should use fallback name
    expect(workbook.SheetNames[0]).toBe('Sheet');
  });
});

describe('XLSX_MIME_TYPE', () => {
  it('should be correct MIME type for xlsx files', () => {
    expect(XLSX_MIME_TYPE).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });
});

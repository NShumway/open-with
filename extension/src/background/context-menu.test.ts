import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerContextMenus,
  getFileTypeFromMenuId,
  isOurMenuItem,
  MENU_ID_PREFIX,
} from './context-menu';

// Mock Chrome contextMenus API
const mockRemoveAll = vi.fn();
const mockCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockRemoveAll.mockImplementation((callback) => callback?.());

  // @ts-expect-error - Mocking global chrome object
  global.chrome = {
    contextMenus: {
      removeAll: mockRemoveAll,
      create: mockCreate,
    },
  };
});

describe('registerContextMenus', () => {
  const mockDefaults = {
    xlsx: { name: 'Microsoft Excel', bundleId: 'com.microsoft.excel' },
    docx: { name: 'Microsoft Word', bundleId: 'com.microsoft.word' },
    pptx: { name: 'Microsoft PowerPoint', bundleId: 'com.microsoft.powerpoint' },
    txt: { name: 'TextEdit', bundleId: 'com.apple.textedit' },
    pdf: { name: 'Preview', bundleId: 'com.apple.preview' },
  };

  it('should remove existing menus first', async () => {
    await registerContextMenus(mockDefaults);

    expect(mockRemoveAll).toHaveBeenCalled();
  });

  it('should create menu for each site type', async () => {
    await registerContextMenus(mockDefaults);

    // Should create 3 menus (Sheets, Docs, Slides)
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should use correct app names in menu titles', async () => {
    await registerContextMenus(mockDefaults);

    // Find the Excel menu
    const excelCall = mockCreate.mock.calls.find(
      (call) => call[0].id === `${MENU_ID_PREFIX}-xlsx`
    );
    expect(excelCall).toBeDefined();
    expect(excelCall![0].title).toBe('Open in Microsoft Excel');

    // Find the Word menu
    const wordCall = mockCreate.mock.calls.find(
      (call) => call[0].id === `${MENU_ID_PREFIX}-docx`
    );
    expect(wordCall).toBeDefined();
    expect(wordCall![0].title).toBe('Open in Microsoft Word');

    // Find the PowerPoint menu
    const pptCall = mockCreate.mock.calls.find(
      (call) => call[0].id === `${MENU_ID_PREFIX}-pptx`
    );
    expect(pptCall).toBeDefined();
    expect(pptCall![0].title).toBe('Open in Microsoft PowerPoint');
  });

  it('should use "desktop app" when no default app is set', async () => {
    const emptyDefaults = {
      xlsx: { name: '', bundleId: '' },
      docx: { name: '', bundleId: '' },
      pptx: { name: '', bundleId: '' },
      txt: { name: '', bundleId: '' },
      pdf: { name: '', bundleId: '' },
    };

    await registerContextMenus(emptyDefaults);

    const xlsxCall = mockCreate.mock.calls.find(
      (call) => call[0].id === `${MENU_ID_PREFIX}-xlsx`
    );
    expect(xlsxCall).toBeDefined();
    expect(xlsxCall![0].title).toBe('Open in desktop app');
  });

  it('should set correct context and URL patterns', async () => {
    await registerContextMenus(mockDefaults);

    const xlsxCall = mockCreate.mock.calls.find(
      (call) => call[0].id === `${MENU_ID_PREFIX}-xlsx`
    );
    expect(xlsxCall).toBeDefined();
    expect(xlsxCall![0].contexts).toEqual(['page']);
    expect(xlsxCall![0].documentUrlPatterns).toContain(
      'https://docs.google.com/spreadsheets/d/*'
    );
  });
});

describe('getFileTypeFromMenuId', () => {
  it('should extract xlsx from menu ID', () => {
    expect(getFileTypeFromMenuId('reclaim-openwith-xlsx')).toBe('xlsx');
  });

  it('should extract docx from menu ID', () => {
    expect(getFileTypeFromMenuId('reclaim-openwith-docx')).toBe('docx');
  });

  it('should extract pptx from menu ID', () => {
    expect(getFileTypeFromMenuId('reclaim-openwith-pptx')).toBe('pptx');
  });

  it('should return null for invalid menu ID prefix', () => {
    expect(getFileTypeFromMenuId('other-extension-xlsx')).toBeNull();
  });

  it('should return null for invalid file type', () => {
    expect(getFileTypeFromMenuId('reclaim-openwith-invalid')).toBeNull();
  });

  it('should handle numeric menu IDs', () => {
    expect(getFileTypeFromMenuId(123)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(getFileTypeFromMenuId('')).toBeNull();
  });
});

describe('isOurMenuItem', () => {
  it('should return true for our menu items', () => {
    expect(isOurMenuItem('reclaim-openwith-xlsx')).toBe(true);
    expect(isOurMenuItem('reclaim-openwith-docx')).toBe(true);
    expect(isOurMenuItem('reclaim-openwith-pptx')).toBe(true);
  });

  it('should return false for other menu items', () => {
    expect(isOurMenuItem('other-extension')).toBe(false);
    expect(isOurMenuItem('copy')).toBe(false);
  });

  it('should handle numeric menu IDs', () => {
    expect(isOurMenuItem(123)).toBe(false);
  });
});

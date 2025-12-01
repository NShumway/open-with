import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerService,
  detectService,
  getServiceHandler,
  getSupportedServices,
  clearServices,
} from './index';
import { ServiceHandler, DropboxFileInfo, GoogleFileInfo } from '../../types/services';

// Mock service handlers for testing
const mockDropboxHandler: ServiceHandler<DropboxFileInfo> = {
  name: 'Dropbox',
  type: 'dropbox',
  detect: (url: string) => {
    if (url.includes('dropbox.com')) {
      return {
        service: 'dropbox',
        fileId: 'test-id',
        fileType: 'pdf',
        url,
        isSharedLink: true,
      };
    }
    return null;
  },
  getDownloadUrl: async (info) => `https://download.com/${info.fileId}`,
  parseTitle: (title) => title.replace(' - Dropbox', ''),
};

const mockGoogleHandler: ServiceHandler<GoogleFileInfo> = {
  name: 'Google Sheets',
  type: 'google',
  detect: (url: string) => {
    if (url.includes('docs.google.com/spreadsheets')) {
      return {
        service: 'google',
        fileId: 'google-id',
        fileType: 'xlsx',
        url,
        exportUrl: `https://docs.google.com/spreadsheets/d/google-id/export`,
      };
    }
    return null;
  },
  getDownloadUrl: async (info) => info.exportUrl,
  parseTitle: (title) => title.replace(' - Google Sheets', ''),
};

describe('Service Registry', () => {
  beforeEach(() => {
    clearServices();
  });

  describe('registerService', () => {
    it('should register a service handler', () => {
      registerService(mockDropboxHandler);
      const handler = getServiceHandler('dropbox');
      expect(handler).toBe(mockDropboxHandler);
    });

    it('should overwrite existing handler for same type', () => {
      const firstHandler = { ...mockDropboxHandler, name: 'First' };
      const secondHandler = { ...mockDropboxHandler, name: 'Second' };

      registerService(firstHandler);
      registerService(secondHandler);

      const handler = getServiceHandler('dropbox');
      expect(handler?.name).toBe('Second');
    });
  });

  describe('getServiceHandler', () => {
    it('should return null for unregistered service type', () => {
      const handler = getServiceHandler('box');
      expect(handler).toBeNull();
    });

    it('should return registered handler', () => {
      registerService(mockGoogleHandler);
      const handler = getServiceHandler('google');
      expect(handler).toBe(mockGoogleHandler);
    });
  });

  describe('detectService', () => {
    it('should return null when no services registered', () => {
      const result = detectService('https://www.dropbox.com/scl/fi/abc123/test.pdf');
      expect(result).toBeNull();
    });

    it('should detect Dropbox URL', () => {
      registerService(mockDropboxHandler);
      const result = detectService('https://www.dropbox.com/scl/fi/abc123/test.pdf');

      expect(result).not.toBeNull();
      expect(result?.handler).toBe(mockDropboxHandler);
      expect(result?.info.service).toBe('dropbox');
    });

    it('should detect Google URL', () => {
      registerService(mockGoogleHandler);
      const result = detectService('https://docs.google.com/spreadsheets/d/abc123/edit');

      expect(result).not.toBeNull();
      expect(result?.handler).toBe(mockGoogleHandler);
      expect(result?.info.service).toBe('google');
    });

    it('should return null for unknown URL', () => {
      registerService(mockDropboxHandler);
      registerService(mockGoogleHandler);

      const result = detectService('https://example.com/file');
      expect(result).toBeNull();
    });

    it('should use first matching handler when multiple registered', () => {
      registerService(mockDropboxHandler);
      registerService(mockGoogleHandler);

      const result = detectService('https://www.dropbox.com/scl/fi/abc123/test.pdf');
      expect(result?.handler.type).toBe('dropbox');
    });
  });

  describe('getSupportedServices', () => {
    it('should return empty array when no services registered', () => {
      const services = getSupportedServices();
      expect(services).toEqual([]);
    });

    it('should return info for all registered services', () => {
      registerService(mockDropboxHandler);
      registerService(mockGoogleHandler);

      const services = getSupportedServices();
      expect(services).toHaveLength(2);
    });

    it('should include correct metadata', () => {
      registerService(mockDropboxHandler);

      const services = getSupportedServices();
      expect(services[0]).toEqual({
        type: 'dropbox',
        name: 'Dropbox',
        displayName: 'Dropbox',
        supportedFileTypes: [],
      });
    });
  });
});

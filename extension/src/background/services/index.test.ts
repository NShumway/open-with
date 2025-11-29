import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerService,
  detectService,
  getServiceHandler,
  getSupportedServices,
  clearServices,
} from './index';
import { ServiceHandler, OneDriveFileInfo, GoogleFileInfo } from '../../types/services';

// Mock service handlers for testing
const mockOneDriveHandler: ServiceHandler<OneDriveFileInfo> = {
  name: 'OneDrive',
  type: 'onedrive',
  detect: (url: string) => {
    if (url.includes('onedrive.live.com')) {
      return {
        service: 'onedrive',
        fileId: 'test-id',
        fileType: 'xlsx',
        url,
        isSharePoint: false,
      };
    }
    return null;
  },
  getDownloadUrl: async (info) => `https://download.com/${info.fileId}`,
  parseTitle: (title) => title.replace(' - OneDrive', ''),
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
      registerService(mockOneDriveHandler);
      const handler = getServiceHandler('onedrive');
      expect(handler).toBe(mockOneDriveHandler);
    });

    it('should overwrite existing handler for same type', () => {
      const firstHandler = { ...mockOneDriveHandler, name: 'First' };
      const secondHandler = { ...mockOneDriveHandler, name: 'Second' };

      registerService(firstHandler);
      registerService(secondHandler);

      const handler = getServiceHandler('onedrive');
      expect(handler?.name).toBe('Second');
    });
  });

  describe('getServiceHandler', () => {
    it('should return null for unregistered service type', () => {
      const handler = getServiceHandler('dropbox');
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
      const result = detectService('https://onedrive.live.com/edit.aspx?resid=123');
      expect(result).toBeNull();
    });

    it('should detect OneDrive URL', () => {
      registerService(mockOneDriveHandler);
      const result = detectService('https://onedrive.live.com/edit.aspx?resid=123');

      expect(result).not.toBeNull();
      expect(result?.handler).toBe(mockOneDriveHandler);
      expect(result?.info.service).toBe('onedrive');
    });

    it('should detect Google URL', () => {
      registerService(mockGoogleHandler);
      const result = detectService('https://docs.google.com/spreadsheets/d/abc123/edit');

      expect(result).not.toBeNull();
      expect(result?.handler).toBe(mockGoogleHandler);
      expect(result?.info.service).toBe('google');
    });

    it('should return null for unknown URL', () => {
      registerService(mockOneDriveHandler);
      registerService(mockGoogleHandler);

      const result = detectService('https://example.com/file');
      expect(result).toBeNull();
    });

    it('should use first matching handler when multiple registered', () => {
      registerService(mockOneDriveHandler);
      registerService(mockGoogleHandler);

      const result = detectService('https://onedrive.live.com/edit.aspx?resid=123');
      expect(result?.handler.type).toBe('onedrive');
    });
  });

  describe('getSupportedServices', () => {
    it('should return empty array when no services registered', () => {
      const services = getSupportedServices();
      expect(services).toEqual([]);
    });

    it('should return info for all registered services', () => {
      registerService(mockOneDriveHandler);
      registerService(mockGoogleHandler);

      const services = getSupportedServices();
      expect(services).toHaveLength(2);
    });

    it('should include correct metadata', () => {
      registerService(mockOneDriveHandler);

      const services = getSupportedServices();
      expect(services[0]).toEqual({
        type: 'onedrive',
        name: 'OneDrive',
        displayName: 'OneDrive',
        supportedFileTypes: [],
      });
    });
  });
});

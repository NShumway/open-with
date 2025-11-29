// Tests for popup service registry integration
// Verifies popup.ts uses detectService() from service registry
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test that popup.ts imports and uses detectService
// Since popup.ts is DOM-heavy and hard to unit test directly,
// we'll verify the imports and function signatures instead

describe('Popup service registry integration', () => {
  describe('dynamic service list', () => {
    it('should have code to populate service list dynamically', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that popup uses getSupportedServices to build the list
      expect(content).toMatch(/getSupportedServices\s*\(\)/);
    });

    it('should populate site-list element with services', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that popup manipulates site-list element
      expect(content).toMatch(/site-list|siteList/);
    });
  });

  describe('import verification', () => {
    it('should import detectService from services/index', async () => {
      // Read popup.ts and verify it imports detectService
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that detectService is imported from services registry
      expect(content).toMatch(/import\s*{[^}]*detectService[^}]*}\s*from\s*['"]\.\.\/background\/services(\/index)?['"]/);
    });

    it('should import getSupportedServices from services/index', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that getSupportedServices is imported
      expect(content).toMatch(/import\s*{[^}]*getSupportedServices[^}]*}\s*from\s*['"]\.\.\/background\/services(\/index)?['"]/);
    });

    it('should NOT import getSiteConfig from site-registry', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that getSiteConfig is NOT imported
      expect(content).not.toMatch(/import\s*{[^}]*getSiteConfig[^}]*}\s*from\s*['"]\.\.\/background\/site-registry['"]/);
    });
  });

  describe('detection usage verification', () => {
    it('should use detectService() for URL detection', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that detectService is called
      expect(content).toMatch(/detectService\s*\(/);
    });

    it('should NOT use getSiteConfig() for URL detection', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that getSiteConfig is NOT called
      expect(content).not.toMatch(/getSiteConfig\s*\(/);
    });

    it('should use handler.parseTitle() for title parsing', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that handler.parseTitle is used
      expect(content).toMatch(/handler\.parseTitle\s*\(/);
    });

    it('should use info.fileType for file type', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const popupPath = path.join(__dirname, 'popup.ts');
      const content = fs.readFileSync(popupPath, 'utf-8');

      // Check that info.fileType is used
      expect(content).toMatch(/info\.fileType/);
    });
  });
});

// Service registry for multi-service support
// Central registry for service handlers (OneDrive, Dropbox, Box, Google)

import {
  ServiceType,
  ServiceFileInfo,
  ServiceHandler,
  ServiceInfo,
} from '../../types/services';

// Re-export types for convenience
export { ServiceHandler, ServiceFileInfo, ServiceInfo } from '../../types/services';

// Private registry of service handlers
const serviceHandlers = new Map<ServiceType, ServiceHandler>();

/**
 * Register a service handler
 * @param handler - The service handler to register
 */
export function registerService(handler: ServiceHandler): void {
  serviceHandlers.set(handler.type, handler);
}

/**
 * Get a service handler by type
 * @param type - The service type to look up
 * @returns The handler or null if not registered
 */
export function getServiceHandler(type: ServiceType): ServiceHandler | null {
  return serviceHandlers.get(type) || null;
}

/**
 * Detect which service a URL belongs to
 * @param url - The URL to check
 * @returns Handler and file info if detected, null otherwise
 */
export function detectService(
  url: string
): { handler: ServiceHandler; info: ServiceFileInfo } | null {
  for (const handler of serviceHandlers.values()) {
    const info = handler.detect(url);
    if (info) {
      return { handler, info };
    }
  }
  return null;
}

/**
 * Get metadata about all registered services
 * @returns Array of service info objects
 */
export function getSupportedServices(): ServiceInfo[] {
  return Array.from(serviceHandlers.values()).map((h) => ({
    type: h.type,
    name: h.name,
    displayName: h.name,
    supportedFileTypes: [],
  }));
}

/**
 * Clear all registered services (for testing)
 */
export function clearServices(): void {
  serviceHandlers.clear();
}

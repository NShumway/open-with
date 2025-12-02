// Type definitions for Reclaim Open With extension

// Re-export all types from messages module
export * from './messages';

// Re-export V2 extraction types
export * from './extraction';

// Legacy types (deprecated - use messages.ts types instead)
export interface NativeMessage {
  type: string;
  payload?: unknown;
}

export interface AppConfig {
  name: string;
  command: string;
  args?: string[];
  urlPatterns?: string[];
}

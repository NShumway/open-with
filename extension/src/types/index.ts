// Type definitions for Reclaim Open With extension

// Re-export all types from messages module
export * from './messages';

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

// Buffer polyfill for browser environment
// Required by docx library which uses Node.js Buffer
import { Buffer } from 'buffer';

// Make Buffer available globally for docx library
globalThis.Buffer = Buffer;

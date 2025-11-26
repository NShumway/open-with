// Native messaging protocol type definitions
// Shared types for communication between extension and native host

// File types supported by the extension
export type FileType = 'xlsx' | 'docx' | 'pptx' | 'txt' | 'pdf';

// Application info returned by native host
export interface AppInfo {
  name: string;
  bundleId: string;
}

// Default apps mapping for each file type
export interface DefaultApps {
  xlsx: AppInfo;
  docx: AppInfo;
  pptx: AppInfo;
  txt: AppInfo;
  pdf: AppInfo;
}

// Native messaging request types
export interface GetDefaultsRequest {
  action: 'getDefaults';
}

export interface OpenRequest {
  action: 'open';
  filePath: string;
  fileType: FileType;
}

export type NativeRequest = GetDefaultsRequest | OpenRequest;

// Native messaging response types
export interface GetDefaultsResponse {
  success: true;
  defaults: DefaultApps;
}

export interface OpenResponse {
  success: true;
}

export type NativeErrorCode =
  | 'no_default_app'
  | 'file_not_found'
  | 'permission_denied'
  | 'download_failed'
  | 'unknown';

export interface ErrorResponse {
  success: false;
  error: NativeErrorCode;
  fileType?: FileType;
  message?: string;
}

export type NativeResponse = GetDefaultsResponse | OpenResponse | ErrorResponse;

// Type guard for successful responses
export function isSuccessResponse(
  response: NativeResponse
): response is GetDefaultsResponse | OpenResponse {
  return response.success === true;
}

// Type guard for GetDefaultsResponse
export function isGetDefaultsResponse(
  response: NativeResponse
): response is GetDefaultsResponse {
  return response.success === true && 'defaults' in response;
}

// Type guard for OpenResponse
export function isOpenResponse(
  response: NativeResponse
): response is OpenResponse {
  return response.success === true && !('defaults' in response);
}

// Type guard for ErrorResponse
export function isErrorResponse(
  response: NativeResponse
): response is ErrorResponse {
  return response.success === false;
}

// Note: Site configuration (SiteConfig, SITE_CONFIGS) is defined in
// background/site-registry.ts to keep URL matching logic centralized

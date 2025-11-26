// Native messaging client for communicating with the native host
// Handles type-safe request/response messaging with error handling

import {
  NativeRequest,
  NativeResponse,
  GetDefaultsResponse,
  OpenResponse,
  ErrorResponse,
  DefaultApps,
  FileType,
  isGetDefaultsResponse,
  isOpenResponse,
} from '../types/messages';

const HOST_NAME = 'com.reclaim.openwith';
const MESSAGE_TIMEOUT_MS = 5000;

/**
 * Error class for native messaging failures
 */
export class NativeMessagingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fileType?: FileType
  ) {
    super(message);
    this.name = 'NativeMessagingError';
  }
}

/**
 * Send a message to the native host and wait for response
 * @param request - The request to send
 * @returns Promise resolving to the response
 * @throws NativeMessagingError on failure
 */
function sendNativeMessage(request: NativeRequest): Promise<NativeResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new NativeMessagingError(
          'Native host did not respond. The app may not be installed correctly.',
          'timeout'
        )
      );
    }, MESSAGE_TIMEOUT_MS);

    chrome.runtime.sendNativeMessage(
      HOST_NAME,
      request,
      (response: NativeResponse | undefined) => {
        clearTimeout(timeout);

        // Check for Chrome API errors
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || 'Unknown error';

          // Common error patterns
          if (errorMessage.includes('not found')) {
            reject(
              new NativeMessagingError(
                'Native host not found. Please run the installer.',
                'host_not_found'
              )
            );
          } else if (errorMessage.includes('access')) {
            reject(
              new NativeMessagingError(
                'Cannot connect to native host. Check file permissions.',
                'access_denied'
              )
            );
          } else {
            reject(
              new NativeMessagingError(
                `Native host error: ${errorMessage}`,
                'connection_error'
              )
            );
          }
          return;
        }

        // Check for missing response
        if (!response) {
          reject(
            new NativeMessagingError(
              'Native host returned empty response',
              'empty_response'
            )
          );
          return;
        }

        // Check for application-level errors
        if (!response.success) {
          const errorResp = response as ErrorResponse;
          reject(
            new NativeMessagingError(
              errorResp.message || `Operation failed: ${errorResp.error}`,
              errorResp.error,
              errorResp.fileType
            )
          );
          return;
        }

        resolve(response);
      }
    );
  });
}

/**
 * Get the default applications for each file type
 * @returns Promise resolving to the default apps mapping
 */
export async function getDefaultApps(): Promise<DefaultApps> {
  const response = await sendNativeMessage({ action: 'getDefaults' });

  if (!isGetDefaultsResponse(response)) {
    throw new NativeMessagingError(
      'Unexpected response format from native host',
      'invalid_response'
    );
  }

  return response.defaults;
}

/**
 * Open a file with the default application
 * @param filePath - Path to the file to open
 * @param fileType - The type of file being opened
 */
export async function openFile(filePath: string, fileType: FileType): Promise<void> {
  const response = await sendNativeMessage({
    action: 'open',
    filePath,
    fileType,
  });

  if (!isOpenResponse(response)) {
    throw new NativeMessagingError(
      'Unexpected response format from native host',
      'invalid_response'
    );
  }
}

/**
 * Check if the native host is available
 * @returns Promise resolving to true if available
 */
export async function isHostAvailable(): Promise<boolean> {
  try {
    await getDefaultApps();
    return true;
  } catch {
    return false;
  }
}

export { HOST_NAME, MESSAGE_TIMEOUT_MS };

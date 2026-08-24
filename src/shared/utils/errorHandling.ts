/**
 * Shared error handling utilities.
 *
 * Provides type-safe error message extraction and formatting
 * for use across both main and renderer processes.
 */

/**
 * Extracts a human-readable error message from an unknown error value.
 * Handles Error instances, strings, and other types safely.
 *
 * @param error - The error value (could be Error, string, or unknown)
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Wraps an unknown error into an Error that keeps the original message and adds
 * context about the operation that failed.
 *
 * @param context - Description of the failed operation, e.g. 'Failed to load sessions'
 * @param error - The original error value
 * @returns An Error suitable for rethrowing to the caller
 */
export function wrapError(context: string, error: unknown): Error {
  return new Error(`${context}: ${getErrorMessage(error)}`);
}

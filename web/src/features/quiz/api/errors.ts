// Shared API error utilities for quiz data fetching
// Path: web/src/features/quiz/api/errors.ts

export type ApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'network'
  | 'server'
  | 'client'
  | 'decode'
  | 'abort'
  | 'unknown';

export type ApiErrorOptions = {
  status?: number;
  code?: string;
  retryable?: boolean;
  cause?: unknown;
  details?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    const defaultRetryable = kind === 'server' || kind === 'network' || kind === 'timeout' || kind === 'offline';
    this.retryable = options.retryable ?? defaultRetryable;
    this.details = options.details;
    this.cause = options.cause;

    const errorCtor = Error as ErrorConstructor & {
      captureStackTrace?: (target: Error, constructorOpt?: (...args: unknown[]) => void) => void;
    };
    if (options.cause && errorCtor.captureStackTrace) {
      errorCtor.captureStackTrace(this, ApiError);
    }
  }
}

export function ensureApiError(error: unknown, fallback: string = 'Unexpected error occurred'): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof TypeError) {
    return new ApiError('network', error.message || fallback, { cause: error });
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new ApiError('abort', error.message || fallback, { cause: error, retryable: false });
    }
    return new ApiError('unknown', error.message || fallback, { cause: error });
  }

  return new ApiError('unknown', fallback, { details: error });
}

export function mapApiErrorToMessage(error: unknown): string {
  const apiError = ensureApiError(error);
  const status = apiError.status;

  switch (apiError.kind) {
    case 'offline':
      return 'You appear to be offline. Check your internet connection and try again.';
    case 'timeout':
      return 'The request is taking longer than expected. Please retry in a moment.';
    case 'network':
      return 'We could not reach the server. Please verify your connection and try again.';
    case 'server':
      if (status === 429) {
        return 'The request rate limit was reached. Please wait a few seconds and try again.';
      }
      if (status === 503) {
        return 'The service is temporarily unavailable. Please try again shortly.';
      }
      return status ? `The server encountered an error (HTTP ${status}). Please try again shortly.` : 'The server encountered an error. Please try again shortly.';
    case 'client':
      return status ? `The request could not be processed (HTTP ${status}). Please refresh the page and try again.` : 'Your request could not be processed. Please refresh the page and try again.';
    case 'decode':
      return 'Received an unexpected response from the server. Please retry.';
    case 'abort':
      return 'The request was cancelled. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function isNavigatorOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!('onLine' in navigator)) return false;
  return navigator.onLine === false;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

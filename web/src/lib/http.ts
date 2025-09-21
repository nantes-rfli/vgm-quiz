// Lightweight JSON fetch wrapper without `any` types.
// Returns a Result<T> with normalized error codes.
export type HttpErrorCode =
  | 'token_expired'
  | 'invalid_token'
  | 'rate_limited'
  | 'http_error'
  | 'server_error'
  | 'network_error'
  | 'invalid_json';

export interface HttpError {
  code: HttpErrorCode;
  status?: number;
  message: string;
  cause?: unknown;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: HttpError };

const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeHttpError(status: number): HttpError {
  switch (status) {
    case 401:
    case 403:
      return { code: 'invalid_token', status, message: 'Unauthorized' };
    case 419:
    case 440:
      return { code: 'token_expired', status, message: 'Session expired' };
    case 429:
      return { code: 'rate_limited', status, message: 'Too many requests' };
    default:
      return { code: 'http_error', status, message: `HTTP ${status}` };
  }
}

export async function httpJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Result<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });

    if (!res.ok) {
      return { ok: false, error: normalizeHttpError(res.status) };
    }

    // In case of 204 No Content
    if (res.status === 204) {
      return { ok: true, data: (undefined as unknown) as T };
    }

    let json: unknown;
    try {
      json = (await res.json()) as unknown;
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'invalid_json',
          status: res.status,
          message: 'Response was not valid JSON',
          cause: e,
        },
      };
    }

    return { ok: true, data: json as T };
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    const timedOut = name === 'AbortError';
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: timedOut ? 'Request timed out' : 'Network error',
        cause: e,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

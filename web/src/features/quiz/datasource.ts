// Path: web/src/features/quiz/datasource.ts
'use client';

import type { RoundStartRequest, Manifest } from './api/manifest';
import type { Phase1StartResponse, Phase1NextResponse } from './api/types';
import { ApiError, ensureApiError, delay, isNavigatorOffline } from './api/errors';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const IS_MOCK = process.env.NEXT_PUBLIC_API_MOCK !== '0';
const DEFAULT_RETRIES = IS_MOCK ? 0 : 3;

type RequestOptions = {
  method: 'GET' | 'POST';
  body?: unknown;
  retries?: number;
};

async function fetchJson<T>(path: string, options: RequestOptions): Promise<T> {
  const { method, body, retries = DEFAULT_RETRIES } = options;
  const url = IS_MOCK ? path : `${API_BASE_URL}${path}`;

  let attempt = 0;
  let lastError: ApiError | undefined;

  while (attempt <= retries) {
    try {
      if (!IS_MOCK && isNavigatorOffline()) {
        throw new ApiError('offline', 'Offline detected before request', { retryable: false });
      }

      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        let payload: unknown;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          payload = await response.json().catch(() => undefined);
        }

        const errorCode =
          typeof payload === 'object' && payload !== null
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (typeof (payload as any).error === 'string'
                ? (payload as any).error
                : ((payload as any).error?.code ?? (payload as any).code))
            : undefined;
        const errorMessage =
          typeof payload === 'object' && payload !== null
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (typeof (payload as any).error === 'string'
                ? (payload as any).message
                : ((payload as any).error?.message ?? (payload as any).message))
            : undefined;

        const status = response.status;
        const isRateLimited = status === 429;
        const isServerError = status >= 500;
        const isRetryableStatus = isRateLimited || status === 503 || isServerError;
        const kind: ApiError['kind'] = isRateLimited || isServerError ? 'server' : status >= 400 ? 'client' : 'unknown';

        const fallbackMessage = isRateLimited
          ? 'Too many requests'
          : status === 503
            ? 'Service unavailable'
            : `Request failed with status ${status}`;

        throw new ApiError(kind, errorMessage || fallbackMessage, {
          status,
          code: errorCode,
          cause: payload,
          retryable: isRetryableStatus,
        });
      }

      const text = await response.text();
      if (!text) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return undefined as any as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new ApiError('decode', 'Failed to parse server response', { cause: error });
      }
    } catch (error) {
      let apiError: ApiError;
      if (error instanceof ApiError) {
        apiError = error;
      } else if (error instanceof TypeError) {
        apiError = new ApiError('network', error.message || 'Network request failed', { cause: error });
      } else {
        apiError = ensureApiError(error, 'Request failed');
      }

      if (apiError.kind === 'offline') {
        throw apiError;
      }

      if (apiError.retryable && attempt < retries) {
        lastError = apiError;
        const delayMs = 1000 * 2 ** attempt;
        attempt += 1;
        await delay(delayMs);
        continue;
      }

      throw apiError;
    }
  }

  throw lastError ?? new ApiError('unknown', 'Request failed after multiple attempts');
}

export async function start(params: Partial<RoundStartRequest> = {}): Promise<Phase1StartResponse> {
  const filtersPresent = params.difficulty || params.era || (params.series && params.series.length > 0);
  const body: {
    mode?: string;
    total?: number;
    seed?: string;
    filters?: {
      difficulty?: string[];
      era?: string[];
      series?: string[];
    };
  } = {
    mode: params.mode,
    total: params.total,
    seed: params.seed,
    filters: filtersPresent
      ? {
          difficulty: params.difficulty ? [params.difficulty] : undefined,
          era: params.era ? [params.era] : undefined,
          series: params.series && params.series.length > 0 ? [...params.series] : undefined,
        }
      : undefined,
  };

  return fetchJson<Phase1StartResponse>('/v1/rounds/start', {
    method: 'POST',
    body,
  });
}

export async function next(payload: {
  continuationToken: string;
  answer: string;
}): Promise<Phase1NextResponse> {
  return fetchJson<Phase1NextResponse>('/v1/rounds/next', { method: 'POST', body: payload });
}

export async function manifest(): Promise<Manifest> {
  return fetchJson<Manifest>('/v1/manifest', { method: 'GET' });
}

// Path: web/src/features/quiz/datasource.ts
'use client';

import type { RoundsStartResponse, RoundsNextResponse, MetricsRequest } from './api/types';

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text) as T;
}

export async function start(): Promise<RoundsStartResponse> {
  const res = await fetch('/v1/rounds/start', { method: 'POST' });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return json<RoundsStartResponse>(res);
}

export async function next(): Promise<RoundsNextResponse> {
  const res = await fetch('/v1/rounds/next', { method: 'POST' });
  if (!res.ok) throw new Error(`next failed: ${res.status}`);
  return json<RoundsNextResponse>(res);
}

// Fire-and-forget metrics
export function sendMetrics(payload: MetricsRequest): void {
  try {
    fetch('/v1/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  } catch {
    // ignore
  }
}

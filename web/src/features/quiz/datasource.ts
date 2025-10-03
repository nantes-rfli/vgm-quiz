// Path: web/src/features/quiz/datasource.ts
'use client';

import type { RoundsStartResponse, RoundsNextResponse } from './api/types';

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return undefined as any as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON response: ${message}`);
  }
}

export async function start(): Promise<RoundsStartResponse> {
  const res = await fetch('/v1/rounds/start', { method: 'POST' });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return json<RoundsStartResponse>(res);
}

export async function next(payload: { token: string; answer: { questionId: string; choiceId: string } }): Promise<RoundsNextResponse> {
  const res = await fetch('/v1/rounds/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`next failed: ${res.status}`);
  return json<RoundsNextResponse>(res);
}

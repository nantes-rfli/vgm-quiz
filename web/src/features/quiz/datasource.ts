// Path: web/src/features/quiz/datasource.ts
'use client';

import type { Phase1StartResponse, Phase1NextResponse } from './api/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const IS_MOCK = process.env.NEXT_PUBLIC_API_MOCK !== '0';

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

export async function start(): Promise<Phase1StartResponse> {
  const url = IS_MOCK ? '/v1/rounds/start' : `${API_BASE_URL}/v1/rounds/start`;
  const res = await fetch(url, { method: 'GET' }); // Phase 1: GET
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return json<Phase1StartResponse>(res);
}

export async function next(payload: {
  continuationToken: string;
  answer: string;
}): Promise<Phase1NextResponse> {
  const url = IS_MOCK ? '/v1/rounds/next' : `${API_BASE_URL}/v1/rounds/next`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`next failed: ${res.status}`);
  return json<Phase1NextResponse>(res);
}

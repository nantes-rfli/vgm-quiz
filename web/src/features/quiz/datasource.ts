import { httpJson, type Result } from '../../lib/http';
import type { StartResponse, NextResponse, MetricsRequest } from './api/types';

const BASE = ''; // relative origin; MSW intercepts /v1/*
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function start(): Promise<Result<StartResponse>> {
  return httpJson<StartResponse>(`${BASE}/v1/rounds/start`, { method: 'POST' });
}

export async function next(token: string): Promise<Result<NextResponse>> {
  return httpJson<NextResponse>(`${BASE}/v1/rounds/next`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Fire-and-forget metrics (awaits the request but ignores the result)
export async function sendMetrics(payload: MetricsRequest): Promise<void> {
  await httpJson<unknown>(`${BASE}/v1/metrics`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

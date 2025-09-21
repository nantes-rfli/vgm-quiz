import { httpJson } from '../../lib/http';
import type { StartResponse, NextResponse } from './api/types';
import type { Result } from '../../lib/http';

const BASE = ''; // use relative origin; MSW intercepts /v1/*

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

import { http, HttpResponse } from 'msw';

// Helper to parse our mock token: "mock.<idx>.<rid>"
function parseMockToken(t: string): { idx: number; rid: string } | null {
  if (!t?.startsWith('mock.')) return null;
  const parts = t.split('.');
  if (parts.length < 3) return null;
  const idx = Number(parts[1]);
  const rid = parts.slice(2).join('.');
  if (Number.isNaN(idx)) return null;
  return { idx, rid };
}

export const handlers = [
  // Start round
  http.post('/v1/rounds/start', async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    if (body?.filters?.forceInsufficient) {
      const err = await fetch('/mocks/api/errors/insufficient_inventory.json').then(r => r.json());
      return HttpResponse.json(err, { status: 409 });
    }
    const fx = await fetch('/mocks/api/rounds_start.success.json').then(r => r.json());
    return HttpResponse.json(fx, { status: 200 });
  }),

  // Next question
  http.post('/v1/rounds/next', async ({ request }) => {
    const { token } = await request.json().catch(() => ({ token: '' }));
    if (token === 'expired') {
      const err = await fetch('/mocks/api/errors/token_expired.json').then(r => r.json());
      return HttpResponse.json(err, { status: 401 });
    }
    if (!parseMockToken(token)) {
      const err = await fetch('/mocks/api/errors/invalid_token.json').then(r => r.json());
      return HttpResponse.json(err, { status: 401 });
    }
    const { idx } = parseMockToken(token)!;
    if (idx >= 9) {
      const done = await fetch('/mocks/api/rounds_next.done.json').then(r => r.json());
      return HttpResponse.json(done, { status: 200 });
    }
    const fxPath = `/mocks/api/rounds_next.q${String(idx + 1).padStart(2, '0')}.json`;
    const fx = await fetch(fxPath).then(r => r.json());
    return HttpResponse.json(fx, { status: 200 });
  }),

  // Metrics ingest
  http.post('/v1/metrics', async () => {
    const fx = await fetch('/mocks/api/metrics.accepted.json').then(r => r.json());
    return HttpResponse.json(fx, { status: 202 });
  }),
];
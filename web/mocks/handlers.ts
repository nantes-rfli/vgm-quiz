import { http, HttpResponse } from 'msw';
import startFixture from './fixtures/rounds.start.ok.json';
import nextFixture from './fixtures/rounds.next.ok.json';
import metricsFixture from './fixtures/metrics.accepted.json';

export const handlers = [
  // POST /v1/rounds/start
  http.post('/v1/rounds/start', async () => {
    return HttpResponse.json(startFixture, { status: 200 });
  }),

  // POST /v1/rounds/next
  http.post('/v1/rounds/next', async () => {
    // 例: トークンを見るなどの擬似ロジック（任意）
    // const body = await request.json().catch(() => ({} as any));
    // if (body.token === 'tok_end') return HttpResponse.json({ done: true }, { status: 200 });

    return HttpResponse.json(nextFixture, { status: 200 });
  }),

  // POST /v1/metrics
  http.post('/v1/metrics', async () => {
    return HttpResponse.json(metricsFixture, { status: 202 });
  }),
];

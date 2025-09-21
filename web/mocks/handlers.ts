import { http, HttpResponse } from 'msw';
import startFixture from './fixtures/rounds.start.ok.json';
import nextFixture from './fixtures/rounds.next.ok.json';
import metricsFixture from './fixtures/metrics.accepted.json';

// 何問で終了させるか（検証を早めたい場合は 3 などに）
const MAX_QUESTIONS = 10;

// ラウンド内の出題カウント（メモリ上）
let count = 0;

export const handlers = [
  // POST /v1/rounds/start
  http.post('/v1/rounds/start', async () => {
    count = 1;
    return HttpResponse.json(startFixture, { status: 200 });
  }),

  // POST /v1/rounds/next
  http.post('/v1/rounds/next', async () => {
    count += 1;
    const finished = count > MAX_QUESTIONS;

    // フィクスチャをベースに、終端フラグだけ足す
    return HttpResponse.json(
      { ...nextFixture, finished },
      { status: 200 },
    );
  }),

  // POST /v1/metrics
  http.post('/v1/metrics', async () => {
    return HttpResponse.json(metricsFixture, { status: 202 });
  }),
];

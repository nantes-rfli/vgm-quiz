// MSW handlers aligned to CONTRACT-ALIGN-01
// - /v1/metrics: 202 Accepted, empty body
// - /v1/rounds/start: returns rounds.start.ok.json and resets state
// - /v1/rounds/next: returns rounds.next.ok.json until the MAX is reached, then finished=true

import { http, HttpResponse } from 'msw';

// JSON fixtures (TypeScript's resolveJsonModule should be enabled)
import roundsStart from './fixtures/rounds.start.ok.json';
import roundsNextOk from './fixtures/rounds.next.ok.json';
import roundsNextFinished from './fixtures/rounds.next.finished.json';

// Simple in-memory state to simulate quiz progress
let answeredCount = 0;
const MAX_QUESTIONS = 10;

export const handlers = [
  // Start: reset state and return first question
  http.post('/v1/rounds/start', async () => {
    answeredCount = 0;
    return HttpResponse.json(roundsStart, { status: 200 });
  }),

  // Next: after each answer, increase the counter.
  // When the user just answered the last question, return finished:true (no question).
  http.post('/v1/rounds/next', async () => {
    answeredCount += 1;
    if (answeredCount >= MAX_QUESTIONS) {
      return HttpResponse.json(roundsNextFinished, { status: 200 });
    }
    return HttpResponse.json(roundsNextOk, { status: 200 });
  }),

  // Metrics: fire-and-forget; respond 202 with empty body
  http.post('/v1/metrics', async () => {
    return new HttpResponse(null, { status: 202 });
  })
];

export default handlers;

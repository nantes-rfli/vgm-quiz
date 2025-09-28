import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY_EVENTS } from '@/src/lib/metrics/constants';

let recordMetricsEvent: typeof import('@/src/lib/metrics/metricsClient').recordMetricsEvent;
let flushMetrics: typeof import('@/src/lib/metrics/metricsClient').flushMetrics;

const getQueue = () => {
  const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
  return raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
};

beforeEach(async () => {
  vi.resetModules();
  ({ recordMetricsEvent, flushMetrics } = await import('@/src/lib/metrics/metricsClient'));
  localStorage.clear();
});

describe('metricsClient contract', () => {
  it('stores events with required fields', () => {
    recordMetricsEvent('answer_result', {
      roundId: 'round-1',
      questionIdx: 2,
      attrs: {
        outcome: 'correct',
        remainingSeconds: 9,
      },
    });

    const queue = getQueue();
    expect(queue).toHaveLength(1);
    const event = queue[0];
    expect(event?.name).toBe('answer_result');
    expect(typeof event?.id).toBe('string');
    expect(typeof event?.ts).toBe('string');
    expect(event?.round_id).toBe('round-1');
    expect(event?.question_idx).toBe(2);
    expect(event?.attrs).toMatchObject({ outcome: 'correct', remainingSeconds: 9 });
  });

  it('builds payload with client metadata when flushing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    recordMetricsEvent('answer_select', {
      roundId: 'round-2',
      questionIdx: 1,
      attrs: { choiceId: 'a' },
    });

    vi.clearAllTimers();
    await flushMetrics();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body.client).toMatchObject({
      client_id: expect.any(String),
      app_version: expect.any(String),
      tz: expect.stringContaining('+'),
    });
    expect(Array.isArray(body.events)).toBe(true);
    const lastEvent = body.events.at(-1);
    expect(lastEvent).toMatchObject({
      name: 'answer_select',
      round_id: 'round-2',
      question_idx: 1,
      attrs: { choiceId: 'a' },
    });

    await vi.waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY_EVENTS)).toBeNull();
    });
  });
});

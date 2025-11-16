import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY_EVENTS } from '@/src/lib/metrics/constants';
import { MetricsBatchSchema, PendingEventSchema } from '@/src/lib/metrics/schemas';
import type { MetricsEventName } from '@/src/lib/metrics/types';

let recordMetricsEvent: typeof import('@/src/lib/metrics/metricsClient').recordMetricsEvent;
let flushMetrics: typeof import('@/src/lib/metrics/metricsClient').flushMetrics;

async function loadClient() {
  ({ recordMetricsEvent, flushMetrics } = await import('@/src/lib/metrics/metricsClient'));
}

const getQueue = () => {
  const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
  return raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe('metricsClient contract', () => {
  it('stores events that satisfy the pending event schema', async () => {
    await loadClient();
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
    const validated = PendingEventSchema.parse(event);
    expect(validated.name).toBe('answer_result');
    expect(validated.round_id).toBe('round-1');
    expect(validated.question_idx).toBe(2);
    expect(validated.retryCount).toBe(0);
    expect(typeof validated.idempotencyKey).toBe('string');
    expect(validated.attrs).toMatchObject({ outcome: 'correct', remainingSeconds: 9 });
  });

  it('builds payload with client metadata when flushing', async () => {
    await loadClient();
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
    const parsed = MetricsBatchSchema.parse(body);
    expect(parsed.client).toMatchObject({
      client_id: expect.any(String),
      app_version: expect.any(String),
      tz: expect.stringContaining('+'),
    });
    const lastEvent = parsed.events.at(-1);
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

  it('rejects events that fall outside the shared schema', async () => {
    await loadClient();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    recordMetricsEvent('invalid_event' as MetricsEventName, {
      attrs: { shouldDrop: true },
    });

    expect(getQueue()).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid pending metrics event (enqueue)'));
  });

  it('omits attributes that cannot be serialized', async () => {
    await loadClient();
    recordMetricsEvent('answer_select', {
      attrs: {
        ok: 'value',
        skipUndefined: undefined,
        nested: { keep: true, drop: () => {} },
        list: ['a', undefined, 'b'],
      },
    });

    const [event] = getQueue();
    expect(event?.attrs).toEqual({
      ok: 'value',
      nested: { keep: true },
      list: ['a', 'b'],
    });
  });

  it('removes malformed queued events on hydration', async () => {
    const invalidEvent = [{ bad: true }];
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(invalidEvent));

    await loadClient();

    expect(getQueue()).toHaveLength(0);
  });
});

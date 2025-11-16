import pkg from '../../../package.json';
import {
  METRICS_ENDPOINT,
  FLUSH_BATCH_SIZE,
  BASE_RETRY_MS,
  RETRY_JITTER_RATIO,
  MAX_RETRY_COUNT,
  MAX_QUEUE_SIZE,
} from './constants';
import { loadQueue, saveQueue } from './storage';
import { getClientId, createUuid } from './clientId';
import type { MetricsBatch, MetricsEventName, PendingEvent } from './types';
import { MetricsBatchSchema, PendingEventSchema } from './schemas';

const APP_VERSION =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_VERSION
    ? process.env.NEXT_PUBLIC_APP_VERSION
    : pkg.version ?? '0.0.0';

function computeTzOffset(): string {
  if (typeof Date === 'undefined') return '+00:00';
  const offsetMinutes = new Date().getTimezoneOffset();
  const total = Math.abs(offsetMinutes);
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  const minutes = String(total % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function nowMs(): number {
  return Date.now();
}

function readyFilter(event: PendingEvent, now: number): boolean {
  return event.nextAttempt <= now;
}

type AttrValue = string | number | boolean | null | AttrValue[] | { [key: string]: AttrValue };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function normalizeAttrValue(value: unknown): AttrValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    const normalized: AttrValue[] = [];
    for (const entry of value) {
      const next = normalizeAttrValue(entry);
      if (next !== undefined) normalized.push(next);
    }
    return normalized.length ? normalized : undefined;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    const normalizedEntries: Array<[string, AttrValue]> = [];
    for (const [key, entry] of entries) {
      const next = normalizeAttrValue(entry);
      if (next !== undefined) normalizedEntries.push([key, next]);
    }
    return normalizedEntries.length ? Object.fromEntries(normalizedEntries) : undefined;
  }
  return undefined;
}

function sanitizeAttributes(attrs?: Record<string, unknown>): Record<string, AttrValue> | undefined {
  if (!attrs) return undefined;
  const normalizedEntries: Array<[string, AttrValue]> = [];
  for (const [key, value] of Object.entries(attrs)) {
    const normalized = normalizeAttrValue(value);
    if (normalized !== undefined) {
      normalizedEntries.push([key, normalized]);
    }
  }
  if (!normalizedEntries.length) return undefined;
  return Object.fromEntries(normalizedEntries);
}

function normalizeEvent(event: PendingEvent): PendingEvent {
  return {
    ...event,
    attrs: sanitizeAttributes(event.attrs),
    retryCount: event.retryCount ?? 0,
    nextAttempt: event.nextAttempt ?? 0,
    idempotencyKey: event.idempotencyKey ?? createUuid(),
  };
}

function logMetricsWarning(message: string, error?: unknown) {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  if (error instanceof Error) {
    console.warn(`[metrics] ${message}: ${error.message}`);
    return;
  }
  if (error) {
    console.warn(`[metrics] ${message}`, error);
    return;
  }
  console.warn(`[metrics] ${message}`);
}

function validatePendingEvent(event: PendingEvent, context: string): PendingEvent | null {
  const parsed = PendingEventSchema.safeParse(event);
  if (parsed.success) {
    return parsed.data;
  }
  logMetricsWarning(`Invalid pending metrics event (${context})`, parsed.error);
  return null;
}

function validateBatch(batch: MetricsBatch): MetricsBatch | null {
  const parsed = MetricsBatchSchema.safeParse(batch);
  if (parsed.success) {
    return parsed.data;
  }
  logMetricsWarning('Invalid metrics batch payload', parsed.error);
  return null;
}

export type RecordOptions = {
  roundId?: string;
  questionIdx?: number;
  attrs?: Record<string, unknown>;
};

class MetricsClient {
  private queue: PendingEvent[] = [];
  private isFlushing = false;
  private flushTimer: number | null = null;
  private started = false;
  private readonly tz = computeTzOffset();
  private clientId = 'server';

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.queue = loadQueue()
      .map(normalizeEvent)
      .map((event) => validatePendingEvent(event, 'hydrate'))
      .filter((event): event is PendingEvent => Boolean(event));
    saveQueue(this.queue);
    this.clientId = getClientId();
    this.installLifecycleHandlers();
    this.scheduleFlush(BASE_RETRY_MS);
  }

  record(name: MetricsEventName, options: RecordOptions = {}): void {
    if (typeof window === 'undefined') return;
    if (!this.started) this.start();

    const event: PendingEvent = {
      id: createUuid(),
      name,
      ts: new Date().toISOString(),
      round_id: options.roundId,
      question_idx: options.questionIdx,
      attrs: sanitizeAttributes(options.attrs),
      retryCount: 0,
      nextAttempt: nowMs(),
      idempotencyKey: createUuid(),
    };
    this.enqueue(event);
  }

  async flush(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!this.started) this.start();
    await this.flushInternal();
  }

  flushWithBeacon(): void {
    if (typeof window === 'undefined') return;
    if (!this.started) this.start();
    if (!navigator.sendBeacon) {
      this.flush();
      return;
    }
    const now = nowMs();
    const ready = this.queue.filter((event) => readyFilter(event, now)).slice(0, FLUSH_BATCH_SIZE);
    if (!ready.length) return;
    const payload = this.buildBatch(ready);
    const validatedPayload = validateBatch(payload);
    if (!validatedPayload) {
      this.discardEvents(ready, 'payload validation failed');
      return;
    }
    const blob = new Blob([JSON.stringify(validatedPayload)], { type: 'application/json' });
    const ok = navigator.sendBeacon(METRICS_ENDPOINT, blob);
    if (ok) {
      const readyIds = new Set(ready.map((event) => event.id));
      this.queue = this.queue.filter((event) => !readyIds.has(event.id));
      saveQueue(this.queue);
    } else {
      this.bumpRetries(ready, BASE_RETRY_MS);
    }
  }

  private enqueue(event: PendingEvent): void {
    const normalized = normalizeEvent(event);
    const validated = validatePendingEvent(normalized, 'enqueue');
    if (!validated) return;
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
    this.queue.push(validated);
    saveQueue(this.queue);
    this.scheduleFlush(0);
  }

  private async flushInternal(): Promise<void> {
    if (this.isFlushing) return;
    const now = nowMs();
    const ready = this.queue.filter((event) => readyFilter(event, now)).slice(0, FLUSH_BATCH_SIZE);
    if (!ready.length) {
      this.scheduleNextPending(now);
      return;
    }

    this.isFlushing = true;
    const payload = this.buildBatch(ready);
    const validatedPayload = validateBatch(payload);
    if (!validatedPayload) {
      this.discardEvents(ready, 'payload validation failed');
      this.isFlushing = false;
      if (this.queue.length) this.scheduleFlush(BASE_RETRY_MS);
      return;
    }

    try {
      const res = await fetch(METRICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedPayload),
        keepalive: ready.length <= FLUSH_BATCH_SIZE,
      });

      if (res.status === 202 || (res.status >= 200 && res.status < 300)) {
        const readyIds = new Set(ready.map((event) => event.id));
        this.queue = this.queue.filter((event) => !readyIds.has(event.id));
        saveQueue(this.queue);
      } else if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '', 10);
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BASE_RETRY_MS;
        this.bumpRetries(ready, delay);
      } else {
        this.bumpRetries(ready);
      }
    } catch {
      this.bumpRetries(ready);
    } finally {
      this.isFlushing = false;
      if (this.queue.length) this.scheduleFlush(BASE_RETRY_MS);
    }
  }

  private buildBatch(events: PendingEvent[]): MetricsBatch {
    return {
      client: {
        client_id: this.clientId,
        app_version: APP_VERSION,
        tz: this.tz,
      },
      events: events.map((event) => {
        const { retryCount, nextAttempt, idempotencyKey, ...rest } = event;
        void retryCount;
        void nextAttempt;
        void idempotencyKey;
        return rest;
      }),
    };
  }

  private bumpRetries(events: PendingEvent[], baseDelay = BASE_RETRY_MS): void {
    const now = nowMs();
    const readyIds = new Set(events.map((event) => event.id));
    this.queue = this.queue.flatMap((event) => {
      if (!readyIds.has(event.id)) return [event];
      const retry = (event.retryCount ?? 0) + 1;
      if (retry > MAX_RETRY_COUNT) {
        return [];
      }
      const jitter = baseDelay * RETRY_JITTER_RATIO * (Math.random() - 0.5) * 2;
      const delay = Math.max(baseDelay + jitter, BASE_RETRY_MS);
      return [
        {
          ...event,
          retryCount: retry,
          nextAttempt: now + delay,
        },
      ];
    });
    saveQueue(this.queue);
  }

  private scheduleFlush(delayMs: number): void {
    if (typeof window === 'undefined') return;
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flushInternal();
    }, Math.max(0, delayMs));
  }

  private scheduleNextPending(now: number): void {
    const next = this.queue.reduce<number | null>((acc, event) => {
      if (acc === null || event.nextAttempt < acc) return event.nextAttempt;
      return acc;
    }, null);
    if (next !== null) {
      this.scheduleFlush(Math.max(0, next - now));
    }
  }

  private installLifecycleHandlers(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushWithBeacon();
        } else {
          this.scheduleFlush(0);
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.scheduleFlush(0));
      window.addEventListener('pagehide', () => this.flushWithBeacon());
    }
  }

  private discardEvents(events: PendingEvent[], reason: string): void {
    if (!events.length) return;
    logMetricsWarning(`Discarding ${events.length} metrics event(s): ${reason}`);
    const invalidIds = new Set(events.map((event) => event.id));
    this.queue = this.queue.filter((event) => !invalidIds.has(event.id));
    saveQueue(this.queue);
  }
}

export const metricsClient = new MetricsClient();

export function recordMetricsEvent(name: MetricsEventName, options?: RecordOptions): void {
  metricsClient.record(name, options);
}

export function flushMetrics(): Promise<void> {
  return metricsClient.flush();
}

if (typeof window !== 'undefined') {
  metricsClient.start();
}

export type PerfEvent = {
  type: 'mark' | 'measure';
  name: string;
  detail?: Record<string, unknown>;
  duration?: number;
};

function pushEvent(event: PerfEvent): void {
  if (typeof window === 'undefined') return;
  const store = (window as unknown as { __PERF_EVENTS__?: PerfEvent[] }).__PERF_EVENTS__ ?? [];
  if (!Array.isArray(store)) return;
  store.push(event);
  (window as unknown as { __PERF_EVENTS__?: PerfEvent[] }).__PERF_EVENTS__ = store;
}

export function mark(name: string, detail?: Record<string, unknown>): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  try {
    performance.mark(name, detail);
    pushEvent({ type: 'mark', name, detail });
  } catch {
    // ignore mark errors
  }
}

export function measure(name: string, startMark: string, endMark: string, detail?: Record<string, unknown>): void {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
  try {
    performance.measure(name, { start: startMark, end: endMark, detail });
    const entries = performance.getEntriesByName(name);
    const last = entries.at(-1);
    pushEvent({ type: 'measure', name, duration: last?.duration, detail });
  } catch {
    // ignore measure errors when marks are missing
  }
}

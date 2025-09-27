import { STORAGE_KEY_EVENTS } from './constants';
import type { PendingEvent } from './types';

export function loadQueue(): PendingEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingEvent[];
  } catch {
    return [];
  }
}

export function saveQueue(events: PendingEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (!events.length) {
      localStorage.removeItem(STORAGE_KEY_EVENTS);
    } else {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    }
  } catch {
    // ignore storage errors
  }
}

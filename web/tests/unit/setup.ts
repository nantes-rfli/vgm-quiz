import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear?.();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-09-28T00:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear?.();
});

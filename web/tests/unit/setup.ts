import { afterEach, beforeEach, vi } from 'vitest';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } satisfies Storage;
}

function ensureStorage(target: 'localStorage' | 'sessionStorage'): Storage {
  const globalTarget = globalThis as Record<string, unknown>;
  let existing: Storage | undefined;
  try {
    existing = globalTarget[target] as Storage | undefined;
  } catch {
    existing = undefined;
  }
  if (existing && typeof existing.clear === 'function') {
    return existing;
  }
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, target, {
    configurable: true,
    writable: true,
    value: storage,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, target, {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
  return storage;
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

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

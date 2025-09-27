import { STORAGE_KEY_CLIENT_ID } from './constants';

export function createUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getClientId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
    if (existing) return existing;
    const uuid = createUuid();
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, uuid);
    return uuid;
  } catch {
    return createUuid();
  }
}

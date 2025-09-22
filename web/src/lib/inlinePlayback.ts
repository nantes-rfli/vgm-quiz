// Manage inline playback user setting (localStorage)
const KEY = 'vgm2.settings.inlinePlayback';

export function getInlinePlayback(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return false; // default OFF
    return raw === '1';
  } catch {
    return false;
  }
}

export function setInlinePlayback(v: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {}
}

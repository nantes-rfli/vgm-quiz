// Path: web/src/lib/logger.ts
const DEBUG = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === '1';

type LogLevel = 'log' | 'warn' | 'error';

function out(level: LogLevel, args: unknown[]) {
  if (!DEBUG) return;
  const ts = (typeof performance !== 'undefined' && performance.now)
    ? `${performance.now().toFixed(1)}ms`
    : new Date().toISOString();
  console[level]('[VGM2]', ts, ...args);
}

export function dlog(...args: unknown[]) { out('log', args); }
export function dwarn(...args: unknown[]) { out('warn', args); }
export function derr(...args: unknown[]) { out('error', args); }

export function mark(label: string) {
  if (!DEBUG || typeof performance === 'undefined' || !performance.mark) return;
  try { performance.mark(`VGM2:${label}`); } catch {}
}

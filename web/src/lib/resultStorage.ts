export type Score = { correct: number; wrong: number; unknown: number };

export type ResultSummary = {
  answeredCount: number;
  total: number;
  score?: Score;
  startedAt?: string;  // ISO8601
  finishedAt?: string; // ISO8601
  durationMs?: number; // derived
};

export const RESULT_KEY = 'vgm2.result.summary';
export const REVEAL_KEY = 'vgm2.result.reveal';

const FALLBACK_KEYS = ['vgm2.result', 'result.summary', 'resultSummary'];

function parseJson<T>(json: string): T | undefined {
  try { return JSON.parse(json) as T; } catch { return undefined; }
}

function withDerived(summary: ResultSummary | undefined): ResultSummary | undefined {
  if (!summary) return summary;
  if (!summary.durationMs && summary.startedAt && summary.finishedAt) {
    const a = Date.parse(summary.startedAt);
    const b = Date.parse(summary.finishedAt);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) return { ...summary, durationMs: b - a };
  }
  return summary;
}

export function loadResult(): ResultSummary | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem(RESULT_KEY);
  if (raw) return withDerived(parseJson<ResultSummary>(raw));
  for (const k of FALLBACK_KEYS) {
    const alt = window.sessionStorage.getItem(k);
    if (alt) {
      const parsed = parseJson<ResultSummary>(alt);
      if (parsed) return withDerived(parsed);
    }
  }
  return undefined;
}

export function saveResult(summary: ResultSummary): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(summary)); } catch {}
}

export function loadLastReveal<T = unknown>(): T | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem(REVEAL_KEY);
  return raw ? parseJson<T>(raw) : undefined;
}

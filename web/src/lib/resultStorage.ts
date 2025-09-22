// Path: web/src/lib/resultStorage.ts
export type ResultSummary = {
  answeredCount: number;
  total: number;
  startedAt?: string; // ISO8601
  finishedAt?: string; // ISO8601
};

export const RESULT_KEY = 'vgm2.result.summary';

const FALLBACK_KEYS = [
  'vgm2.result',
  'result.summary',
  'resultSummary'
];

export function loadResult(): ResultSummary | undefined {
  if (typeof window === 'undefined') return undefined;

  const keys = [RESULT_KEY, ...FALLBACK_KEYS];
  for (const k of keys) {
    const raw = window.sessionStorage.getItem(k);
    if (!raw) continue;
    try {
      const val = JSON.parse(raw) as ResultSummary;
      if (typeof val?.answeredCount === 'number' && typeof val?.total === 'number') {
        return val;
      }
    } catch {
      // ignore malformed
    }
  }
  return undefined;
}

export function saveResult(summary: ResultSummary): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(summary));
  } catch {
    // ignore
  }
}

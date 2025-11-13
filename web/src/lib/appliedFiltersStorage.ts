import type { RoundStartRequest } from '@/src/features/quiz/api/manifest';

export type AppliedFilters = {
  difficulty?: string;
  era?: string;
  series?: string[];
};

const APPLIED_FILTERS_KEY = 'vgm2.applied-filters';

export function saveAppliedFilters(params: Partial<RoundStartRequest>): void {
  if (typeof window === 'undefined') return;
  try {
    const filters: AppliedFilters = {
      difficulty: params.difficulty,
      era: params.era,
      series: params.series,
    };
    window.sessionStorage.setItem(APPLIED_FILTERS_KEY, JSON.stringify(filters));
  } catch {}
}

export function loadAppliedFilters(): AppliedFilters | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(APPLIED_FILTERS_KEY);
    return raw ? (JSON.parse(raw) as AppliedFilters) : undefined;
  } catch {
    return undefined;
  }
}

export function saveOrClearAppliedFilters(params?: Partial<RoundStartRequest>): void {
  if (!params || Object.values(params).every((value) => value === undefined || (Array.isArray(value) && value.length === 0))) {
    clearAppliedFilters();
    return;
  }
  saveAppliedFilters(params);
}

export function clearAppliedFilters(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(APPLIED_FILTERS_KEY);
  } catch {}
}

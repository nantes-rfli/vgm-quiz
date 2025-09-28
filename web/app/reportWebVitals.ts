import type { NextWebVitalsMetric } from 'next/dist/shared/lib/utils';

export function reportWebVitals(metric: NextWebVitalsMetric): void {
  if (typeof window === 'undefined') return;
  const store = (window as unknown as { __VITALS__?: NextWebVitalsMetric[] }).__VITALS__ ?? [];
  store.push(metric);
  (window as unknown as { __VITALS__?: NextWebVitalsMetric[] }).__VITALS__ = store;

  if (process.env.NODE_ENV !== 'production') {
    const rounded = Math.round(metric.value * 100) / 100;
    console.info('[vitals]', metric.name, rounded, metric);
  }
}

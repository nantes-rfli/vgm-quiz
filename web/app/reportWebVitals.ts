import type { NextWebVitalsMetric } from 'next/dist/shared/lib/utils'

const isDev = process.env.NODE_ENV !== 'production'
const VITALS_EVENT_NAME = 'vgm:vitals'

function emitCustomHandler(metric: NextWebVitalsMetric) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  try {
    const event = new CustomEvent(VITALS_EVENT_NAME, { detail: metric })
    window.dispatchEvent(event)
  } catch {
    // In some environments CustomEvent might be blocked or not fully supported; ignore and fall back to console
  }
}

function logToConsole(metric: NextWebVitalsMetric) {
  if (!isDev || typeof console === 'undefined' || typeof console.info !== 'function') return
  const rounded = metric.name === 'CLS'
    ? Math.round(metric.value * 1000) / 1000
    : Math.round(metric.value)
  console.info('[vitals]', metric.name, rounded, metric)
}

export function reportWebVitals(metric: NextWebVitalsMetric): void {
  if (typeof window === 'undefined') return
  const vitalsStore = window as unknown as { __VITALS__?: NextWebVitalsMetric[] }
  if (!Array.isArray(vitalsStore.__VITALS__)) {
    vitalsStore.__VITALS__ = []
  }
  vitalsStore.__VITALS__!.push(metric)

  emitCustomHandler(metric)
  logToConsole(metric)
}

'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/src/lib/i18n'
import { type Locale, setStoredLocale } from '@/src/lib/locale'
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient'

export default function LocaleSwitcher() {
  const { t, locale, setLocale } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function switchLocale() {
    const nextLocale: Locale = locale === 'en' ? 'ja' : 'en'
    setLocale(nextLocale)
    setStoredLocale(nextLocale)
    recordMetricsEvent('settings_locale_toggle', {
      attrs: { from: locale, to: nextLocale },
    })
  }

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <span className="text-foreground">{t('settings.locale')}</span>
        <button
          type="button"
          disabled
          className="px-3 py-1 rounded-xl bg-muted text-muted-foreground text-xs"
          aria-label="Loading locale switcher"
        >
          ...
        </button>
      </div>
    )
  }

  const label = locale === 'en' ? 'English' : '日本語'

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className="text-foreground">{t('settings.locale')}</span>
      <button
        type="button"
        onClick={switchLocale}
        className="px-3 py-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition text-xs"
        aria-label={`Current language: ${label}. Click to change`}
      >
        {label}
      </button>
    </div>
  )
}

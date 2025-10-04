'use client'

import { useTheme } from 'next-themes'
import { useI18n } from '@/src/lib/i18n'
import { useEffect, useState } from 'react'
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient'

export default function ThemeToggle() {
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  function cycleTheme() {
    const currentTheme = theme || 'system'
    const nextTheme = currentTheme === 'light' ? 'dark' : currentTheme === 'dark' ? 'system' : 'light'
    setTheme(nextTheme)
    recordMetricsEvent('settings_theme_toggle', {
      attrs: { from: currentTheme, to: nextTheme },
    })
  }

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <span className="text-foreground">{t('settings.theme')}</span>
        <button
          type="button"
          disabled
          className="px-3 py-1 rounded-xl bg-muted text-muted-foreground text-xs"
          aria-label="Loading theme toggle"
        >
          ...
        </button>
      </div>
    )
  }

  const currentTheme = theme || 'system'
  const label = currentTheme === 'system'
    ? t('settings.themeAuto', { resolved: resolvedTheme || 'light' })
    : currentTheme === 'light'
    ? t('settings.themeLight')
    : t('settings.themeDark')

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className="text-foreground">{t('settings.theme')}</span>
      <button
        type="button"
        onClick={cycleTheme}
        className="px-3 py-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition text-xs"
        aria-label={t('settings.currentTheme', { theme: label })}
      >
        {label}
      </button>
    </div>
  )
}

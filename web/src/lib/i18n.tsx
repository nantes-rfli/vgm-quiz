'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getEffectiveLocale, setStoredLocale, type Locale } from './locale'
import enMessages from '../../locales/en.json'
import jaMessages from '../../locales/ja.json'

const messages = {
  en: enMessages,
  ja: jaMessages,
}

const I18nContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}>({
  locale: 'en',
  setLocale: () => {},
  t: () => '',
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    setLocaleState(getEffectiveLocale())
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    setStoredLocale(newLocale)
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: unknown = messages[locale]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return key // Return key if not found
      }
    }

    let result = typeof value === 'string' ? value : key

    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        result = result.replace(`{${param}}`, String(val))
      })
    }

    return result
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

'use client'

import { useEffect } from 'react'
import { useI18n } from '@/src/lib/i18n'

/**
 * Synchronizes the HTML lang attribute with the current locale.
 * This ensures accessibility tools and search engines see the correct document language.
 */
export function HtmlLangSync() {
  const { locale } = useI18n()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}

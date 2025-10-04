// Locale management
// Storage key: vgm2.settings.locale

export type Locale = 'en' | 'ja'

const locales: Locale[] = ['en', 'ja']
const defaultLocale: Locale = 'en'
const LOCALE_STORAGE_KEY = 'vgm2.settings.locale'

export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && locales.includes(stored as Locale)) {
      return stored as Locale
    }
    return null
  } catch {
    return null
  }
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Ignore storage errors
  }
}

export function getEffectiveLocale(): Locale {
  // First check localStorage
  const stored = getStoredLocale()
  if (stored) return stored

  // Then check browser language
  if (typeof window !== 'undefined' && navigator.language) {
    if (navigator.language.startsWith('ja')) return 'ja'
  }

  return defaultLocale
}

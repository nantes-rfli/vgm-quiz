// Theme management using next-themes
// Storage key: vgm2.settings.theme
export const THEME_STORAGE_KEY = 'vgm2.settings.theme'

export type Theme = 'light' | 'dark' | 'system'

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
    return null
  } catch {
    return null
  }
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage errors
  }
}

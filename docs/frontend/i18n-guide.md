# Internationalization (i18n) Guide

## Overview

VGM Quiz supports Japanese (ja) and English (en) localization with automatic language detection based on browser preferences.

## Architecture

### Supported Locales

- **Japanese** (`ja`) — Primary locale
- **English** (`en`) — Default fallback

### Storage

- **Key**: `vgm2.settings.locale`
- **Location**: `localStorage`
- **Values**: `"ja"`, `"en"`
- **Detection priority**:
  1. User's explicit choice (stored in localStorage)
  2. Browser language (`navigator.language`)
  3. Default fallback (`en`)

### Implementation Files

- [web/src/lib/locale.ts](../../web/src/lib/locale.ts) — Locale type definitions and detection logic
- [web/src/lib/i18n.tsx](../../web/src/lib/i18n.tsx) — i18n context provider and `useI18n` hook
- [web/locales/ja.json](../../web/locales/ja.json) — Japanese translations
- [web/locales/en.json](../../web/locales/en.json) — English translations
- [web/src/components/HtmlLangSync.tsx](../../web/src/components/HtmlLangSync.tsx) — Syncs `<html lang>` attribute with current locale
- [web/src/components/LocaleSwitcher.tsx](../../web/src/components/LocaleSwitcher.tsx) — Language switcher UI component

## Translation Files

### Structure

Translation keys are organized by feature/page:

```json
{
  "play": {
    "answerButton": "回答 (Enter)",
    "nextButton": "次へ (Enter)",
    "timeRemaining": "残り時間"
  },
  "reveal": {
    "listenWatch": "視聴する",
    "openIn": "{provider}で開く"
  },
  "result": {
    "title": "結果",
    "totalScore": "合計スコア {points}"
  },
  "settings": {
    "title": "設定",
    "locale": "言語"
  },
  "outcome": {
    "correct": "正解",
    "wrong": "不正解"
  }
}
```

### Parameter Interpolation

Use curly braces for dynamic values:

```json
{
  "greeting": "Hello, {name}!",
  "score": "You earned {points} points"
}
```

In components:

```tsx
const { t } = useI18n()
t('greeting', { name: 'Alice' })  // "Hello, Alice!"
t('score', { points: '450' })      // "You earned 450 points"
```

## Usage

### In Components

```tsx
import { useI18n } from '@/src/lib/i18n'

function MyComponent() {
  const { t, locale, setLocale } = useI18n()

  return (
    <div>
      <p>{t('play.answerButton')}</p>
      <button onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}>
        Switch language
      </button>
    </div>
  )
}
```

### Locale Switcher Component

The [LocaleSwitcher](../../web/src/components/LocaleSwitcher.tsx) component provides a single-button toggle:

- Click → toggles between Japanese (日本語) and English
- Records `settings_locale_toggle` metrics event

### Settings Page

The [/settings](../../web/app/settings/page.tsx) page provides explicit locale selection with two buttons (日本語/English).

## HTML Lang Attribute Sync

The `<html lang>` attribute automatically updates to match the current locale:

- Japanese → `<html lang="ja">`
- English → `<html lang="en">`

This is handled by [HtmlLangSync](../../web/src/components/HtmlLangSync.tsx) component, which runs a side effect to update the attribute on locale changes.

## Adding New Translations

1. **Add key to both locale files** (`ja.json` and `en.json`)
2. **Use dot notation** for nested keys: `"section.subsection.key"`
3. **Keep structure identical** across locales
4. **Test with both locales** to ensure no missing keys

Example:

```json
// web/locales/ja.json
{
  "newFeature": {
    "title": "新機能",
    "description": "{count}個のアイテムがあります"
  }
}

// web/locales/en.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "You have {count} items"
  }
}
```

## Metrics

Locale changes emit the following event:

```ts
recordMetricsEvent('settings_locale_toggle', {
  attrs: {
    from: 'ja',  // previous locale
    to: 'en',    // new locale
  },
})
```

## Testing

- **E2E**: Language switching tested in [accessibility.spec.ts](../../web/tests/e2e/accessibility.spec.ts)
- **Type Safety**: All translation keys are type-safe through TypeScript inference
- **Missing Keys**: Return the key itself as fallback (e.g., `"section.missing"` if not found)

## Known Limitations

- **Content Translation Only**: Game metadata (composer names, track titles) are not translated in MVP
  - Future: API could provide `meta_ja` and `meta_en` fields
- **No Pluralization**: English plural forms not handled (e.g., "1 items" vs "2 items")
  - Workaround: Use neutral phrasing or include count in string
- **No RTL Support**: Right-to-left languages not currently supported
- **Static Locale List**: Adding new languages requires code changes

## Future Enhancements

- Server-side locale detection for SEO (when migrating from static export)
- Pluralization library (e.g., `i18next`, `formatjs`)
- Metadata translation support in API responses
- User preference synced across devices (requires authentication)

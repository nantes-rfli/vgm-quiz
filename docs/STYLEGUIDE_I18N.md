# I18N Style Guide (v1.6 Baseline)

## Key principles
- **Keys are stable**: `domain.area.leaf` (e.g., `ui.start`, `app.title`, `a11y.ready`)
- **Fallback to EN** is mandatory; never produce empty strings.
- **en embedded** in code → no extra request on first load; other locales are fetched.

## Detection order
`?lang=xx` → `localStorage('lang')` → `navigator.language` → `en`

## Runtime API
- `initI18n()` — detect + load + set `<html lang>` + set `document.title`
- `t(key, params?)` — read a key, with EN fallback; `{name}` variables are replaced
- `setLang(lang)` — switch language at runtime; dispatches `i18n:changed`
- `whenI18nReady()` — Promise resolved when the initial language is applied
- `applyStaticLabels()` — helper to translate Start/History/Share buttons

## Keys (minimum set in v1.6)
```json
{
  "app": { "title": "VGM Quiz" },
  "ui":  { "start": "Start", "history": "History", "share": "Share" },
  "a11y": { "ready": "Ready. Press Start to begin." }
}
```

## Adding UI text
1. Add EN/JA to `public/app/locales/*.json` (same key path)
2. Use `t('…')` instead of hard-coded strings
3. If it’s a static control, consider adding it to `applyStaticLabels()`
4. Verify with `e2e (i18n lang param smoke)` and `e2e (i18n static labels smoke)`

## Non-goals (v1.6)
- No dataset translations (proper nouns preserved)
- No plural rules/MessageFormat (to be evaluated later)
- No RTL handling (en/ja only)


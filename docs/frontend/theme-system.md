# Theme System

## Overview

VGM Quiz implements a theme system supporting Light, Dark, and Auto (system preference) modes using [`next-themes`](https://github.com/pacocoursey/next-themes).

## Architecture

### Provider Setup

The theme system is initialized at the root level in [app/layout.tsx](../../web/app/layout.tsx):

```tsx
<ThemeProvider>
  <HtmlLangSync />
  <MswBoot />
  {children}
</ThemeProvider>
```

### Storage

- **Key**: `vgm2.settings.theme`
- **Location**: `localStorage`
- **Values**: `"light"`, `"dark"`, `"system"`
- **Default**: `"system"` (follows OS/browser preference)

### Implementation Files

- [web/src/lib/theme.ts](../../web/src/lib/theme.ts) — Theme type definitions and storage utilities
- [web/src/components/ThemeProvider.tsx](../../web/src/components/ThemeProvider.tsx) — `next-themes` wrapper
- [web/src/components/ThemeToggle.tsx](../../web/src/components/ThemeToggle.tsx) — Theme switcher UI component
- [web/app/globals.css](../../web/app/globals.css) — CSS custom properties for light/dark themes

## CSS Variables

Theme colors are defined using CSS custom properties in `globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    /* ... */
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    /* ... */
  }
}
```

All UI components use semantic tokens (e.g., `bg-background`, `text-foreground`) instead of hardcoded color classes.

## Usage

### In Components

```tsx
import { useTheme } from 'next-themes'

function MyComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Current: {resolvedTheme}
    </button>
  )
}
```

### Theme Toggle Component

The [ThemeToggle](../../web/src/components/ThemeToggle.tsx) component provides a single-button cycle through themes:

- Click → cycles: Light → Dark → Auto → Light...
- Displays current resolved theme with icon
- Records `settings_theme_toggle` metrics event

### Settings Page

The [/settings](../../web/app/settings/page.tsx) page provides explicit theme selection with three buttons (Light/Dark/Auto).

## Accessibility

- **ARIA**: Theme toggle button includes `aria-label` describing current state and action
- **Focus**: Visible focus indicators compatible with both light and dark themes
- **Contrast**: All theme combinations meet WCAG AA contrast ratios (tested with axe-core)
- **Transitions**: Disabled during theme switch to prevent flash (`disableTransitionOnChange`)

## Metrics

Theme changes emit the following event:

```ts
recordMetricsEvent('settings_theme_toggle', {
  attrs: {
    from: 'light', // previous theme
    to: 'dark',    // new theme
  },
})
```

## Testing

- **E2E**: [accessibility.spec.ts](../../web/tests/e2e/accessibility.spec.ts) validates WCAG compliance in both light and dark modes
- **Unit**: Theme utilities in `theme.ts` handle edge cases (SSR, storage errors)

## Known Limitations

- Theme preference is stored locally only (not synced across devices)
- System theme detection relies on `prefers-color-scheme` media query (IE11 not supported)
- Flash of unstyled content (FOUC) prevented by `suppressHydrationWarning` on `<html>` tag

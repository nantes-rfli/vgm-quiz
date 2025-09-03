# UI Refresh (v1.5 plan)

## Design tokens
- Colors: `--bg`, `--panel`, `--text`, `--muted`, `--border`, `--accent`, `--accent-fg`, `--focus`
- Radii: 10–12px on interactive elements
- Spacing: 10–16px for compact, 20–24px for group/section

## Responsive
- `main{max-width:880px;padding:16px}`
- Choices grid: 2 cols (mobile) → 3 (sm ≥ 640px) → 4 (lg ≥ 960px)
- Touch target: min-height 44px

## Accessibility
- Keep `:focus-visible` outlines
- Live region on #feedback
- Dialog semantics for #result-view
- Landmarks for main/history

## Non-goals
- フレームワーク導入や大規模リライトはしない（静的構成を維持）


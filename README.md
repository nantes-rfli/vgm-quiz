# VGM Quiz

<!-- Status badges -->
<p>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/ci-fast.yml">
    <img alt="CI Fast (main)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/ci-fast.yml/badge.svg?branch=main">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/e2e-matrix.yml">
    <img alt="E2E (matrix)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/e2e-matrix.yml/badge.svg">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/lighthouse.yml">
    <img alt="Lighthouse (nightly)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/lighthouse.yml/badge.svg">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/pages.yml">
    <img alt="Pages (deploy on main)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/pages.yml/badge.svg?branch=main">
  </a>
</p>

### Daily OGP
- 自動生成された OGP 画像は `public/ogp/daily-YYYY-MM-DD.png`（**出題タイプ**：title→game / game→composer / title→composer を表示。判定できない場合は “Daily Question”）
- 画像は GitHub Pages からも配信可能（例: `/vgm-quiz/ogp/daily-YYYY-MM-DD.png`）
- 今は日付のみのシンプル版。後続で楽曲名・出題タイプなどを載せる拡張が可能です。

### Share page
- 毎日の共有用静的ページ: `public/daily/YYYY-MM-DD.html`
- そのURLをSNSに貼ると、上記 OGP 画像のプレビューとともに **`/app/?daily=YYYY-MM-DD`** へ自動リダイレクトします。
- 一覧: `/daily/index.html`（過去分のリンク集）
- 常に当日: `/daily/latest.html`（メタリフレッシュで当日の share page へ）

  A small quiz app for video game music. Runs on GitHub Pages.

- **Live:** https://nantes-rfli.github.io/vgm-quiz/app/
- **Repo:** https://github.com/nantes-rfli/vgm-quiz

## Quick start (local)

```bash
# 1) serve /app for local testing
npx http-server -p 8080 -c-1 .    # or any static server

# 2) open
http://127.0.0.1:8080/app/?test=1&mock=1&autostart=0
```

## Core features

- Quiz modes: Multiple Choice / Free-form; types: **title→game / game→composer / title→composer**
- Deterministic ordering: **seeded RNG** (`?seed=abc`) + **year-bucket pipeline** (`?qp=1`)
- HUD & A11y: lives HUD (`Misses: x/y`), score bar (role=progressbar), timer (`aria-live="polite"`), focus management
- Results modal: **accessible dialog** (initial focus, Tab trap, Escape to close), **share** & **copy** (toast auto disappears in ~2s)
- Media preview: **YouTube** (nocookie first → fallback domain / "Open in YouTube" link); fully **stubbed in tests** (`?test=1` / `?lhci=1` / `?nomedia=1`)
- Daily: **1‑question daily** via `?daily=1` (JST) or `?daily=YYYY-MM-DD` (map in `public/app/daily.json`)
- Lives rule (optional): `?lives=on` (or `?lives=5`) → **on reaching limit, finish immediately** (default is display‑only)

## Ops runbook

### Useful URLs
- Normal: `/app/`
- Test (no SW registration): `/app/?test=1`
- Mock dataset: `/app/?test=1&mock=1`
- Deterministic: `/app/?test=1&seed=demo`
- Year-bucket pipeline: add `&qp=1`
- Daily (today JST): add `&daily=1` (or `&daily=YYYY-MM-DD`)
- Disable media embeds: `&nomedia=1`
- Lighthouse audit: `/app/?test=1&lhci=1`

### Footer (version)
Footer shows: **`Dataset: vN • commit: abcdefg • updated: YYYY-MM-DD HH:mm`** (local time).
`loadVersion()` uses **8s timeout, in‑flight sharing, 60s TTL** to avoid redundant fetches.

#### Debug helpers
- `window.__rng` / `window.__SEED__` – seeded RNG (function) / seed string
- `window.__questionIds` – string of track IDs/titles (when `?test=1`)
- `window.__questionDebug` – array of `{{ title, year, type }}` (when `?test=1`)
- `window.loadVersionPublic()` – non‑force refresh (TTL/in‑flight適用)
- `window.loadVersionForce()` – force refresh (即取得)
- `window.versionDebug.stats()` / `.clear()` – TTLキャッシュの確認/クリア

### Service Worker
- SW polls `version.json` ~every 60s to notify updates.
- **Handshake:** app sends the absolute `version.json` URL to SW at startup; SW uses it (prevents 404 on scoped paths).

### Query flags (summary)
`test, mock, seed, qp, daily, autostart, lhci, nomedia, lives`

| Flag | Example | Purpose |
|---|---|---|
| `test` | `?test=1` | No SW registration; expose debug vars; stub media |
| `mock` | `?mock=1` | Use mock dataset for fast/dev checks |
| `seed` | `?seed=alpha` | Deterministic RNG |
| `qp` | `?qp=1` | Enable year‑bucket order pipeline |
| `daily` | `?daily=1` / `?daily=2000-01-01` | 1‑question daily mode (JST or fixed date) |
| `autostart` | `?autostart=0` | Require manual Start |
| `lhci` | `?lhci=1` | Stub media for Lighthouse |
| `nomedia` | `?nomedia=1` | Manually stub media |
| `lives` | `?lives=on` / `?lives=5` | End immediately when misses reach limit |

## Data & pipeline (overview)

- Clojure/CLJC pipeline exports: `public/build/dataset.json`, `aliases.json`, `version.json`.
- Aliases: app merges `../build/aliases.json` with optional `./aliases_local.json` (**local overrides** → easy PRs).

## Development & tests

### E2E (Playwright)
We run in CI and locally. Local quick run:

```bash
node e2e/test.js
node e2e/test_free_aria.js
node e2e/test_footer_version.js
node e2e/test_results_share.mjs
node e2e/test_lives_visual.mjs
node e2e/test_pipeline_flag.mjs
node e2e/test_media_button.mjs
node e2e/test_results_modal_a11y.mjs
node e2e/test_lives_rule_end.mjs
node e2e/test_normalize_cases.mjs   # Node-only assertions for normalize v1.2
```

### CI workflows (GitHub Actions)
- `ci.yml` / `ci-fast.yml` – Clojure + JS basic tests
- `e2e.yml` – Playwright end‑to‑end
- `pages.yml` – auto deploy to Pages on `main`
- `release.yml` – release
- `lighthouse.yml` – nightly Lighthouse CI against production (`?test=1&lhci=1`)

## Answer normalization v1.2

- Base: NFKC + lower; ignore punctuation/elongation/whitespace; roman ↔ arabic numerals
- **v1.2 adds:** leading English articles ignored (`the|a|an`), dash/hyphen normalization, `&/＆ → and`, stronger roman numeral handling (word‑boundary; I–XX).

## License

MIT

## Documentation

- [Ops Runbook](./docs/ops-runbook.md)
- [Query Flags](./docs/flags.md)
- [CI & E2E](./docs/ci.md)
- [Data Pipeline](./docs/pipeline.md)
- [Release & Deployment](./docs/release.md)
- [Troubleshooting](./docs/troubleshooting.md)


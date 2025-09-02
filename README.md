# VGM Quiz

<!-- Status badges -->
<p>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/ci-fast.yml">
    <img alt="CI Fast (main)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/ci-fast.yml/badge.svg?branch=main">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/ci-fast-pr.yml">
    <img alt="CI Fast (PR)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/ci-fast-pr.yml/badge.svg">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/e2e-matrix.yml">
    <img alt="E2E (matrix)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/e2e-matrix.yml/badge.svg">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/lighthouse.yml">
    <img alt="Lighthouse (nightly)" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/lighthouse.yml/badge.svg">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/json-validate.yml">
    <img alt="JSON Validate" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/json-validate.yml/badge.svg">
  </a>
  <a href="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/pages.yml">
    <img alt="Pages" src="https://github.com/nantes-rfli/vgm-quiz/actions/workflows/pages.yml/badge.svg?branch=main">
  </a>
</p>

## Operations / Runbook
日々の運用で迷いやすいポイントは **[docs/ops.md](docs/ops.md)** に集約しています。
- SW更新確認フロー（waiting→更新バナー）
- Required ジョブ名の注意・Checks が待機のままの対処
- DAILY_PR_PAT の期限切れ兆候と対処
- Actions からの手動実行（json-validate / Pages 再配信）

### Daily OGP
- 自動生成された OGP 画像は `public/ogp/daily-YYYY-MM-DD.png`（**出題タイプ**：title→game / game→composer / title→composer を表示。判定できない場合は “Daily Question”）
- 画像は GitHub Pages からも配信可能（例: `/vgm-quiz/ogp/daily-YYYY-MM-DD.png`）
- 今は日付のみのシンプル版。後続で楽曲名・出題タイプなどを載せる拡張が可能です。

### Share page
- 毎日の共有用静的ページ: `public/daily/YYYY-MM-DD.html`
- そのURLをSNSに貼ると、上記 OGP 画像のプレビューとともに **JS リダイレクト**で `/app/?daily=YYYY-MM-DD` へ遷移します。
- デバッグ用クエリ:
  - `?no-redirect=1` → リダイレクト抑止
  - `?redirectDelayMs=1500` → リダイレクトを 1.5s 遅延
- 一覧: `/daily/index.html`（過去分のリンク集）
- 常に当日: `/daily/latest.html`（**JS リダイレクト**で当日の share page へ。上記のデバッグ用クエリも利用可）

  A small quiz app for video game music. Runs on GitHub Pages.

- Production: https://nantes-rfli.github.io/vgm-quiz/app/
- Daily index: https://nantes-rfli.github.io/vgm-quiz/daily/index.html
- Daily latest redirect: https://nantes-rfli.github.io/vgm-quiz/daily/latest.html （JS リダイレクト）
- Daily RSS feed: https://nantes-rfli.github.io/vgm-quiz/daily/feed.xml
- Repo: https://github.com/nantes-rfli/vgm-quiz

## Quick start (local)

```bash
# 1) serve /app for local testing
npx http-server -p 8080 -c-1 .    # or any static server

# 2) open
http://127.0.0.1:8080/app/?test=1&mock=1&autostart=0
```

## Parameters (quick)

- `?daily=1`（JST 今日）/ `?daily=YYYY-MM-DD`
- `?auto=1` / `?auto_any=1`（検証用途）
- `?seed=abc`（シード固定）, `?qp=1`（年次バケット・決定論的並び）
- `?lives=on` または `?lives=5`（ライフゲージ。上限到達で終了/デフォルトは表示のみ）
- `?test=1` / `?mock=1` / `?autostart=0`（ローカル検証向け）
- `?lhci=1` / `?nomedia=1`（Lighthouse向けスタブ）
- `/daily/*.html`: `?no-redirect=1` / `?redirectDelayMs=...`（JS リダイレクト制御）

> 詳細は `docs/params.md` を参照。

## Features

 - Quiz modes: Multiple Choice / Free-form; types: **title→game / game→composer / title→composer**
 - Deterministic ordering: **seeded RNG** (`?seed=abc`) + **year-bucket pipeline** (`?qp=1`)
 - HUD & A11y: lives HUD (`Misses: x/y`), score bar (role="progressbar"), timer (`aria-live="polite"`), focus management
 - Results modal: **accessible dialog** (initial focus, Tab trap, Escape to close), **share** & **copy** (toast auto disappears in ~2s)
 - Media: **YouTube** (nocookie first → fallback domain / "Open in YouTube" link); fully **stubbed in tests** (`?test=1` / `?lhci=1` / `?nomedia=1`)
 - Daily: **1-question daily** via `?daily=1` (JST) or `?daily=YYYY-MM-DD` (map in `public/app/daily.json`)
 - Lives rule (optional): `?lives=on` (or `?lives=5`) → **on reaching limit, finish immediately** (default is display-only)
 - Answer normalization v1.2: NFKC + lowercase, **diacritics folding**, ignore punctuation/long sound mark/spaces, Roman↔Arabic (1–20), ignore articles, `&→and`, alias dictionary
 - **Daily feed**: static RSS (`/daily/feed.xml`) generated from `public/app/daily.json`
 - **SW update banner**: in-app banner (accessible) prompts reload; `skipWaiting → controllerchange → reload`

## CI & Workflows

See [docs/ci.md](./docs/ci.md) for full details.

- `ci-fast.yml` (main) / `ci-fast-pr.yml` (PR)
- `e2e-matrix.yml` (smoke/a11y/footer/share/**normalize**/**lives**)
- `lighthouse.yml` (nightly desktop, `?test=1&lhci=1` stubs)
- `json-validate.yml` (daily/aliases/dataset lightweight validation)
- `pages.yml` (deploy `public/`) / `pages-pr-build.yml` (PR shim)
- `daily.yml` (00:00 JST bot PR)

## Data pipeline

See [docs/pipeline.md](./docs/pipeline.md).

## Operations

See [docs/ops.md](./docs/ops.md) and [docs/troubleshooting.md](./docs/troubleshooting.md).
Admin guide for PAT/Rulesets/Pages is in [docs/github-admin.md](./docs/github-admin.md).

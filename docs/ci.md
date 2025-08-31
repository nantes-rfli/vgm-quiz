# CI & E2E Overview

## Workflows

- `ci.yml` / `ci-fast.yml` – Clojure + JS basics
- `e2e.yml` – Playwright E2E suite
- `pages.yml` – Deploy to GitHub Pages on `main`
- `release.yml` – Release flow
- `lighthouse.yml` – Nightly Lighthouse CI against production (`?test=1&lhci=1`)

## E2E Suite

```
node e2e/test.js
node e2e/test_free_aria.js
node e2e/test_footer_version.js
node e2e/test_results_share.mjs
node e2e/test_lives_visual.mjs
node e2e/test_pipeline_flag.mjs
node e2e/test_media_button.mjs
node e2e/test_results_modal_a11y.mjs
node e2e/test_lives_rule_end.mjs
node e2e/test_normalize_cases.mjs
```

---

## Current workflow set (clean baseline)

- **CI Fast (PR)** — `.github/workflows/ci-fast-pr.yml`  
  Event: `pull_request` (with `paths: ['**']`)  
  Job name: **`ci-fast-pr-build`** (Required)
- **Pages (PR shim)** — `.github/workflows/pages-pr-build.yml`  
  Event: `pull_request`  
  Job name: **`pages-pr-build`** (Required)
- **CI Fast (main)** — `.github/workflows/ci-fast.yml`  
  Event: `push: main`  
  Job name: `ci-fast-main-build`  
  **Runs `clojure -T:build publish` before tests** to render `public/build/dataset.json`.
- **Pages (deploy)** — `.github/workflows/pages.yml`  
  Event: `push: main` (never on PR)
- **daily.json generator (JST)** — `.github/workflows/daily.yml`  
  Creates PR with **PAT** (`DAILY_PR_PAT`) at 00:00 JST.
- **E2E (nightly)** — `.github/workflows/e2e-nightly.yml` (optional)  
  Heavy Playwright suites on a schedule or manual.
- **Lighthouse (nightly)** — `.github/workflows/lighthouse.yml`

### Required status checks

Register **job names** in Rulesets (not display strings):

- `pages-pr-build`
- `ci-fast-pr-build`

### Clojure tests need the dataset

Tests read `public/build/dataset.json`.  
On `main` CI, run before tests:

```bash
clojure -T:build publish
clojure -M:test
```

### Guidelines

- Prefer `pull_request` over `pull_request_target` unless absolutely necessary.
- Give jobs stable, unique `name:` values; if you rename jobs, update Rulesets together.
- Keep PR checks light; shift heavy suites to nightly or `workflow_dispatch`.

## E2E（並列マトリクス版）

### 目的
- どの観点で落ちたか（smoke/a11y/footer）を **一発で特定**。
- 並列化で **実行時間短縮**、失敗時は該当スイートだけログ確認。

### ワークフロー
- ファイル: `.github/workflows/e2e-matrix.yml`
- トリガ: **manual (`workflow_dispatch`)** 導入 → 問題なければ夜間スケジュールへ移行可能。
- マトリクス: `smoke`（`e2e/test.js`）、`a11y`（`e2e/test_free_aria.js`）、`footer`（`e2e/test_footer_version.js`）、`share`（`e2e/test_share.js`）
`share` は:
- アプリの共有ボタンでコピーされるURLが **`/daily/YYYY-MM-DD.html`** であること
- 共有ページ（存在すれば）のHTMLに **OGP画像** と **`/app/?daily=...`** への meta refresh があること  
（手動実行で当日の共有ページ未生成の場合は 404 を許容）
- 共通環境:
  - `APP_URL=https://nantes-rfli.github.io/vgm-quiz/app/`
  - `E2E_BASE_URL=https://nantes-rfli.github.io/vgm-quiz/app/?test=1`

### 使い方
1. Actions → **E2E (matrix)** → **Run workflow**。
2. 4 本のジョブが並列に走る（smoke/a11y/footer/share）。
3. 失敗したスイートのアーティファクト（`e2e/*.log` / `e2e/screenshots`）をダウンロードして確認。

### 既存の夜間 E2E との関係
- 当面は **併存**（既存は夜間/手動、matrix は手動のみ）。
- 安定確認後に、`e2e-matrix.yml` に `schedule` を追加し、旧ワークフローの夜間実行を停止（`on.schedule`を外す/ファイル削除）するとよい。

### Nightly スケジュール（導入済み）
- 実行時刻: **JST 04:40**（= UTC 19:40）  
  - `daily.json`（JST 00:00）と **Lighthouse (03:10 JST)** の後に走るため、衝突や帯域競合を回避。
- 失敗時の確認手順:
  1. Actions → **E2E (matrix)** の当日実行を開く
  2. 赤いスイートだけを見る（smoke / a11y / footer / share）
  3. 右上 “Artifacts” から `e2e-<suite>-artifacts` を取得（ログ/スクショ）
  4. `docs/troubleshooting.md` の該当節へ

### Artifact 保持
- E2E のログ/スクショは **7日間** 保持（`upload-artifact@v4` の `retention-days: 7`）。

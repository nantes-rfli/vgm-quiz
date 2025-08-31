# CI & E2E Overview

## Workflows

- **`ci-fast.yml`** – main branch: `clojure -T:build publish` → `clojure -M:test`
- **`ci-fast-pr.yml`** – PR軽量チェック（Required: `ci-fast-pr-build`）
- **`pages.yml`** – main への push / 手動で `public/` を GitHub Pages に配信（配信前に **daily index/RSS** を再生成）
- **`pages-pr-build.yml`** – PR用 Pages シム（Required: `pages-pr-build`）
- **`daily.yml`** – 00:00 JST に `public/app/daily.json` と `/daily/*.html` と `/daily/feed.xml` を含む **bot PR** を作成
- **`e2e-matrix.yml`** – Playwright E2E（smoke / a11y / footer / share / **normalize** / **lives**）手動＋Nightly(JST 04:40)
- **`lighthouse.yml`** – Nightly Lighthouse CI（`?test=1&lhci=1`、**budgets** + **asserts**）
- **`json-validate.yml`** – `daily.json` / `aliases.json` / `dataset.json` の軽量バリデーション

## E2E Suite

```
node e2e/test.js
node e2e/test_free_aria.js
node e2e/test_footer_version.js
node e2e/test_share.js
node e2e/test_normalize.js  # ?mock=1 の normalize API を直接検証
node e2e/test_lives.js      # lives=on の汎用検証（入力/MCQ/Enter のフォールバック）
```

### Nightly スケジュール（導入済み）
- 実行時刻: **JST 04:40**（UTC 19:40）
- 失敗時は該当スイートのアーティファクトを確認

### Artifact 保持
- E2E のログ/スクショは **7日間** 保持（`upload-artifact@v4` の `retention-days: 7`）。

## Lighthouse CI（budgets + asserts）
- コンフィグ: `tools/lighthouse/lighthouserc.ci.json`（categories: performance/a11y/seo は warn しきい値で開始）
- **パフォーマンス予算**: `tools/lighthouse/budgets.json`（FCP/LCP/TBT/CLS/bytesなど）。初期はゆるめ→安定後に引き締め。
- レポートURL: ワークフローが **Job Summary にURLを出力**、さらに **HTMLをartifact保存**（7日）

## Required checks（Rulesets）
- **`pages-pr-build` / `ci-fast-pr-build`** の2本が PR の Required。
  - ジョブ名がズレると PR が永遠に「waiting」になるため、変更時は Rulesets 側も必ず更新。

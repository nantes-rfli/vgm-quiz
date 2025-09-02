# CI & E2E Overview

## Workflows

- **`ci-fast.yml`** – main branch: `clojure -T:build publish` → `clojure -M:test`
- **`ci-fast-pr.yml`** – PR軽量チェック（Required: `ci-fast-pr-build`）
- **`pages.yml`** – main への push / 手動で `public/` を GitHub Pages に配信（配信前に **daily index/RSS** を再生成）
- **`pages-pr-build.yml`** – PR用 Pages シム（Required: `pages-pr-build`）
- **`daily.yml`** – 00:00 JST に `public/app/daily.json` と `/daily/*.html` と `/daily/feed.xml` を含む **bot PR** を作成
- **`e2e-matrix.yml`** – Playwright E2E（smoke / a11y / footer / share / **normalize** / **lives**）手動＋Nightly(JST 04:40)
- **`e2e-light-regressions.yml`** – 軽量回帰（**Keyboard flow** / **Share CTA visibility**）。手動＋Nightly(JST 04:25)
- **`lighthouse.yml`** – Nightly Lighthouse CI（`?test=1&lhci=1`、**budgets** + **asserts**）
- **`lighthouse-budgets.yml`** – 予算重視の軽量版（budgets の早期検知）
- **`json-validate.yml`** – `daily.json` / `aliases.json` / `dataset.json` の軽量バリデーション
- **`docs-enforcer.yml`** – コード変更があるPRに **ドキュメント更新**（`README` / `docs/**` / `FEATURES.*` / `ROADMAP` / `CHANGELOG`）が無いと **fail**
- **`roadmap-guard.yml`** – 非ブロッキング。`FEATURES.yml` の **planned** が `ROADMAP.md` に無い場合、PRに**警告コメント**を付与

## E2E Suite

```
node e2e/test.js
node e2e/test_free_aria.js
node e2e/test_footer_version.js
node e2e/test_share.js
node e2e/test_normalize.js  # ?mock=1 の normalize API を直接検証
node e2e/test_lives.js      # lives=on の汎用検証（入力/MCQ/Enter のフォールバック）

# 軽量回帰（ヘッドレス/高速）
node e2e/test_keyboard_flow_smoke.mjs           # Tab→Enter で回答確定できること
node e2e/test_share_cta_visibility.mjs          # /daily/*.html?no-redirect=1 にCTA/導線があること
```

### Nightly スケジュール（導入済み）
- 実行時刻: **JST 04:40**（UTC 19:40） – `e2e-matrix.yml`
- 実行時刻: **JST 04:25**（UTC 19:25） – `e2e-light-regressions.yml`
- 失敗時は該当スイートのアーティファクトを確認

### Artifact 保持
- E2E のログ/スクショは **7日間** 保持（`upload-artifact@v4` の `retention-days: 7`）。

## Lighthouse CI（budgets + asserts）
- コンフィグ: `tools/lighthouse/lighthouserc.ci.json`（categories: performance/a11y/seo は warn しきい値で開始）
- **パフォーマンス予算**: `tools/lighthouse/budgets.json`（FCP/LCP/TBT/CLS/bytesなど）。初期はゆるめ→安定後に引き締め。
- レポートURL: ワークフローが **Job Summary にURLを出力**、さらに **HTMLをartifact保存**（7日）

## E2E アーティファクト（失敗時の見方）

リポの E2E は詳細なアーティファクトを残します。代表例：

- `trace.zip` — `npx playwright show-trace artifacts/trace.zip` で可視化
- `console.log` — ページの console / error 出力
- `network.log` — 失敗/非200のネットワーク記録
- `*.html` / `*.png` — 失敗時点の DOM スナップショットとスクリーンショット

## Required checks（Rulesets）
- **`pages-pr-build` / `ci-fast-pr-build`** の2本が PR の Required。
  - ジョブ名がズレると PR が永遠に「waiting」になるため、変更時は Rulesets 側も必ず更新。

## Docs / Roadmap の整合性チェック
- **docs-enforcer**: コード変更のPRで **ドキュメント差分**が無いと **fail**
- **roadmap-guard**: **非ブロッキング**。`FEATURES.yml` の planned が ROADMAP に無い場合のみ **警告コメント**

### JSON validation（補足）
- **Alias referential integrity（非ブロッキング）**: `aliases*.json` の**canonicalキー**が `dataset.json` のタイトルに存在するかをチェックします。  
  - 既定では **warn**。厳格化したい場合は `ALIAS_STRICT=1` をセットすると **fail** にできます。

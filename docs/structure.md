
# Repository Structure & Boundaries (Clojure × JS)

目的: Clojure（データ生成）と JS（配信アプリ/支援スクリプト）の**責任範囲と境界**を明文化し、将来の分割やリファクタの判断材料にする。

## 境界の原則
- **Clojure**: *ソース・オブ・トゥルース*（EDN → `public/build/dataset.json` / `version.json`）。検証・正規化・ID付与・難易度算出（将来）。
- **Node/JS（scripts）**: Clojure生成物に対する**後処理**（enrich/overrides/ハッシュ更新など）。**生成物の形式は変えず**値を上書きするに留める。
- **Web App（public/app）**: ランタイム表示・UI/UX・A11y・i18n。**データ生成の責務を持たない**（= HTTP取得と描画に集中）。

## ディレクトリ役割
- `src/` – Clojure本体（EDN処理, validators, publish）
- `resources/data/` – 最優先の手動 overrides（レポ内・運用管理）
- `data/` – フォールバックの overrides（検証/実験）
- `scripts/enrich/` – Nodeユーティリティ（`apple_enrich.mjs` / `version_refresh.mjs` など）
- `public/app/` – フロント（UI, media_player, i18n, A11y, E2E hooks）
- `public/build/` – **生成物**（gitignore, PR時のみ force add）
- `e2e/` – Playwright/ライトE2E
- `docs/` – 設計・運用・ADR

## 契約（contract）
- `public/build/dataset.json` **スキーマ互換**を最優先。破壊変更は **major** か **feature flag** で段階導入。
- `media.apple.url` が存在すれば **Apple優先**（プレイヤ側で解釈）。
- overrides は **タイトル一致 or ID一致** の2経路。Node 側は「**上書きのみ**」で**削除はしない**。

## 将来の選択肢（比較用メモ）
1. **現状維持**（境界明確化のみ）：最小コスト。CI/Docs で運用ガードを硬くする。
2. **Monorepo 内パッケージ分割**（`/packages/app` `/packages/pipeline`）：責務分離・CI分割が容易。初期整備コストは中。
3. **別リポ分離**（`vgm-quiz-app` / `vgm-quiz-data`）：変更衝突が減るが、リリース連携が増える。権限/Secrets管理も分割。

> 当面は **1** を採用し、**v1.5 の後に 2 を再検討**。移行判断は `docs/refactor-plan.md` のゲートで行う。

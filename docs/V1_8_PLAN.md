# V1.8 PLAN — Authoring スキーマ & バックフィル（軸） + Publish Surface 最小（サブ）

最終更新: 2025-09-05

## 目的 / 背景
- Authoring データの入口品質を **スキーマ** で保証し、以降の自動化（収集/配信）の失敗率を下げる。
- すでに存在する正規化ルールを **単一ソース** にまとめ、バックフィルで形式・欠損を整理する。
- 露出面（OGP/Feed）を **静的生成** で最小セット確保し、発見性・回遊性を上げる。

## スコープ（軸：スキーマ & バックフィル）
1. **JSON Schema 新設**
   - 置き場所: `schema/daily_v1.schema.json`
   - 対象: `public/app/daily_auto.json`（当日1件 by_date フラット形）
   - 必須: `title`, `game`, `track.composer`, `media.provider`, `media.id`, `answers.canonical`
2. **スキーマ検証のCI必須化**
   - `scripts/validate_authoring_schema.mjs`（fail-fast / 出力は GitHub Annotations 兼用）
   - `authoring-schema-check.yml` を PR 必須チェックに追加
3. **正規化ルールの単一ソース化**
   - 波ダッシュ/長音/CJK間スペース/ローマ数字/「ン」前後長音… を `scripts/normalize_core.mjs` へ集約
   - `docs/NORMALIZATION_RULES.md` にルールを明文化（テストケース併記）
4. **別名辞書の分割管理**
   - `data/aliases/game.json`, `data/aliases/composer.json`, `data/aliases/track.json` などへ分離
   - 参照側は `scripts/normalize_core.mjs` で共通読込
5. **バックフィル**
   - 既存データの欠損補完／フォーマット統一（破壊的変更は避け、差分最小に）
   - ログ出力: `build/logs/backfill_YYYYMMDD.txt`
6. **4択モードの将来互換**
   - `config/authoring.json` に `choices_mode: "auto|always4|one"` を定義（**既定: auto**）
   - auto: 品質ゲート成立時のみ4択、未達は1択へ自動フォールバック（詳細は `docs/SPEC_CHOICES_MODE.md`）

## スコープ（サブ：Publish Surface 最小）
1. **OGP 静的生成（SVG→PNG、外部APIなし）**
   - テンプレ: `assets/og/template.svg`
   - 生成: `scripts/generate_ogp.mjs`（`resvg-js` or `sharp`）→ `public/og/YYYY-MM-DD.png` / `public/og/latest.png`
   - `daily/YYYY-MM-DD.html` / `daily/latest.html` に `og:image`, `twitter:card` を出力
2. **Feed**
   - `public/daily/feed.xml`（RSS2.0）, `public/daily/feed.json`（JSON Feed 1.1）
   - エントリ: 当日1件、`og:image` を enclosure/attachment として露出
3. **キャッシュ戦略**
   - `YYYY-MM-DD.png` は immutable、`latest.png` は短期キャッシュ + ETag

## 受け入れ基準（DoD）
- PR 時に **Schema 検証が必須** で、違反があると赤になる。
- `public/og/YYYY-MM-DD.png` の自動出力と、リンク先 HTML の OGP メタが一致。
- `feed.xml` / `feed.json` が W3C / JSON Feed Validator で正当。
- `choices_mode: auto` で、品質ゲート未達の日は 1択に自動フォールバックし、ログに理由が残る。

## タスク分解（実装順）
1. Schema定義 → Validatorスクリプト → CI組込み（必須チェック）
2. 正規化ルールの集約（`normalize_core.mjs`）→ 既存呼び出しの差し替え → テストケース
3. 別名辞書 `data/aliases/*` へ分割 → 参照コード変更 → バリデータ通過
4. バックフィル（安全な範囲に限定、差分最小／レビューしやすい粒度）
5. OGP: テンプレ作成 → 描画テスト → 生成スクリプト → Actions へ組込み
6. Feed: 生成スクリプト → 出力確認 → Pagesでの配信確認
7. 運用文書の更新（本ファイル、`DESIGN_OGP.md`, `SPEC_CHOICES_MODE.md`, `NORMALIZATION_RULES.md`）

## リスクとフォールバック
- Schema が厳しすぎて既存が赤化 → **段階的導入**（警告→必須化）
- OGP 文字詰め崩れ → テンプレの**禁則・折り返し**強化、フォント代替
- Feed の不整合 → バリデータを CI に導入し fail-fast

## 参考ファイル一覧（予定）
- `schema/daily_v1.schema.json`
- `scripts/validate_authoring_schema.mjs`
- `scripts/normalize_core.mjs`
- `data/aliases/*.json`
- `scripts/generate_ogp.mjs`
- `public/og/YYYY-MM-DD.png`, `public/og/latest.png`
- `public/daily/feed.xml`, `public/daily/feed.json`
- `docs/NORMALIZATION_RULES.md`, `docs/DESIGN_OGP.md`, `docs/SPEC_CHOICES_MODE.md`

## 監視ポイント（v1.8 完了後の軽監視）
- Actions ログ：`schema:` / `normalize:` / `ogp:` / `feed:` の各ステップの所要と異常率
- 生成物：`build/daily_today.*` と `public/og/*.png` の日次検収
- フィード購読：RSS/JSON Feed が購読クライアントで正常反映されるか

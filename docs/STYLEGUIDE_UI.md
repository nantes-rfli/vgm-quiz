# UI Style Guide (v1.5)

> 本ガイドは **CSSのみ** での軽量ポリッシュ方針をまとめたものです。JSは増やさない方針。

## Design Tokens
- 変数は `:root` に定義（既に導入済み）。
- 代表トークン
  - Spacing: `--space-1..6`（4/8/12/16/24/32）
  - Radius: `--radius-1..3`（8/12/16）
  - Shadow: `--shadow-1..2`
  - Typography: `--font-size-sm/base/lg`
  - Motion: `--duration-fast/base`, `--easing-out`
  - Layout: `--container-max`, `--grid-gap`, `--touch-target` (=44px)

## Color / Themes
- ダーク/ライトは `prefers-color-scheme` をベースに、**`data-theme="dark|light"`** で強制切替を可能に。
- Light の最小調整（v1.5）
  - `--panel: #f9fafb`
  - `--border: #d1d5db`
  - `--accent: #1d4ed8`
  - `--focus: #1e40af`
- 目的: **コントラストAA目安**（本文 ≥ 4.5:1、UIラベル ≥ 3:1）を満たす方向へ、最小差分で調整。

## Responsive Grid
- `#choices` は **2→3→4 列**固定（モバイルファースト）
  - `<=599px: 2列` / `600–899px: 3列` / `>=900px: 4列`
  - 実装: `grid-template-columns: repeat(N, …)`
- Gap は `var(--grid-gap)` を使用。

## Touch Targets
- 主要操作（ボタン/選択肢）は **最小 44px**。
  - 実装: `button { min-height: var(--touch-target) }`（既定 44px）
  - 視覚サイズは変えず、**当たり判定だけ**広げる方針。

## Motion
- トランジションは **opacity/transform のみ**、`120–160ms / ease-out`。
- `prefers-reduced-motion: reduce` のときは **全トランジション/アニメーション無効化**。

## History View
- 可読性のため、**薄いストライプ**と **hoverシャドウ** を付与。
- 枠線は `--border`、角丸は `--radius-1`。

## テスト / メトリクス
- E2E: `e2e/test_ui_responsive_smoke.mjs`（44px / 2→3→4列）
- Lighthouse: TBT/MPFID/Bootup 変化なし、Contrast の警告増なし
- a11y スモーク（静的）は既存のまま緑維持

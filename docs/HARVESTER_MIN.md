# Harvester (MIN) — 公式ソース最小導入

目的: 候補（JSONL）生成の段階で、**外部ネットワークに依存せず**に「できる範囲で安全な media を付与」する最小版ハーベスタ。

## 入出力
- 入力: `public/build/dataset.json`（Clojure生成物）
- 付随参照: `resources/data/apple_overrides.jsonc`（**手動管理**の公式 Apple 埋め込み辞書） / `sources/allowlist.json`（**公式IDのみ**許可）
- 出力: `public/app/daily_candidates.jsonl` の各行（候補）に `media` を**可能なら**付与（付かない場合は `null` のまま）

## ルール（安全サイド）
1. **Apple優先**（`apple_overrides.jsonc` 該当があれば `media.apple.embedUrl|previewUrl|url` をそのまま付与）
2. データセット内に `media.apple.*` が既にあれば、それも許容（上書きはしない）
3. **YouTubeは厳格な allowlist のみ**（`sources/allowlist.json` の `youtube` に **動画IDが厳密一致** する場合だけ付与）
4. 外部検索/APIコールは**行わない**（CIの再現性を担保）
5. 付与できない場合は **`media: null` のまま**（後段 `ensure_min_items_v1_post.mjs` が空日を救済）

## ノーマライズとキー
- 既存の `normalizeAnswer` を用い、`norm.game` と `norm.title` を連結した `"${norm.game}__${norm.title}"`（lowercase）を **overrides のキー**として引く。

## 由来（provenance）
- 後続の `docs/POLICY_PROVENANCE.md` に従い、将来的には `provenance` を候補に持たせる（最小版では省略可）。
  - `license_hint`: Apple=official / YouTube=label or official（allowlistを以て best-effort）

## 実行（手動）
```bash
node scripts/harvest_candidates.js --out public/app/daily_candidates.jsonl
```
- 併用が望ましい補助:
  - `node scripts/generate_apple_override_candidates.mjs`
  - `node scripts/smoke_apple_override.mjs`

## よくある質問
- Q. media が全く付かないのは正常？  
  A. はい。**MIN**では付与機会は限定的です。Apple overrides の拡充や allowlist の更新で段階的に増やします。

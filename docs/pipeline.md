# Daily Pipeline (Candidates → Score → Publish) — skeleton

本パッチは **既存フローを変更しません（デフォルトOFF）**。候補収集～スコアリング～公開の骨組みを追加します。

## 生成物
- `public/app/daily_candidates.jsonl` … 候補のJSON Lines（1行=1候補）
- `public/app/daily_auto.json` … 自動パイプライン専用の公開予定マップ（date→candidate）

## ステップ
1. 候補収集（harvest）  
   ```bash
   node scripts/harvest_candidates.js --out public/app/daily_candidates.jsonl
   ```
2. 難易度付与（score）  
   ```bash
   node scripts/score_candidates.js --in public/app/daily_candidates.jsonl --out public/app/daily_candidates_scored.jsonl
   ```
3. 当日分の選定（generate）  
   ```bash
   node scripts/generate_daily_from_candidates.js --in public/app/daily_candidates_scored.jsonl --date 2025-09-01 --out public/app/daily_auto.json
   ```

## 方針
- 既存 `scripts/generate_daily.js` は**一切変更しない**（既存の `daily.json` は温存）
- 自動パイプラインは `daily_auto.json` を別系統として作成（切替は後日）

---

### 候補スキーマ（JSON Lines）
各行は下記の形。
```json
{
  "title": "Corridors of Time",
  "game": "Chrono Trigger",
  "composer": "Yasunori Mitsuda",
  "platform": "SNES",
  "year": 1995,
  "media": { "kind": "youtube", "id": "xxxxxxxxxxx", "start": 45 },
  "source": "dataset",
  "norm": { "title": "corridorsoftime", "game": "chronotrigger", "composer": "yasunorimitsuda" }
}
```
`media` は**空でも可**（将来の自動補完を想定）。

---

### ワークフロー（dispatchのみ）
- `candidates-harvest.yml` … 候補の収集・Artifact化（PRしない）

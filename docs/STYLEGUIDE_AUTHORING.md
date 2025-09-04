# STYLEGUIDE — Authoring (v1.7 MVP)

目的: **毎日1問**を“安全に・再現可能に”自動生成するための **作問データ規約** と **運用手順** を定義する。

## 入力ソース（候補）
- **手動シード**: `public/app/daily_candidates.jsonl` に1行=1候補を追記可能。
- **自動収集（既存）**: `scripts/harvest_candidates.js` が `public/build/dataset.json` から候補を生成。
- **許可リスト**（将来拡張）: 公式YouTube/Apple限定の収集を段階導入。第三者アップロードは対象外。

### 候補の1行（JSONL）最低限
```json
{
  "title": "曲名",
  "game": "作品名",
  "composer": "作曲者",
  "platform": "任意",
  "year": 1995,
  "media": null,
  "source": "dataset",
  "norm": {
    "title": "正規化後",
    "game": "正規化後",
    "composer": "正規化後"
  }
}
```
- `norm.*` は既存の正規化（波ダッシュ/長音/CJK間スペース/ローマ数字/「ン」前後の長音）を適用。
- **ユニークキー**: `norm.title|norm.game|norm.composer`。重複は除外。

## 中間加工（概要）
- `scripts/score_candidates.js` … 難易度の仮スコア付与。`media.start` が無ければ仮に 45s を入れる。
- `scripts/enrich_media_start.js` … URLパラメータ/キーワードから開始秒推定。`--allow-heuristic-media` で `media` 自体を生成可。
- `scripts/generate_daily_from_candidates.js` … 指定日分を `public/app/daily_auto.json` の `by_date` にマージ（30日重複防止、破壊的編集なし）。

## 出力（UIが読む日次ドラフト）
`public/app/daily_auto.json`:
```json
{
  "by_date": {
    "YYYY-MM-DD": {
      "title": "…",
      "game": "…",
      "composer": "…",
      "platform": null,
      "year": 1995,
      "media": null,
      "source": "dataset",
      "norm": { "title": "…", "game": "…", "composer": "…" },
      "difficulty": 4,
      "choices": {
        "composer": ["A","B","C","(正解)"],
        "game": ["A","B","C","(正解)"]
      }
    }
  }
}
```

## ルール（初版）
- **埋め込み再生のみ**: `media.provider` は `youtube` または `apple`（`auto` は内部用）。`id` が空のものは弾く。
- **clip-start**: `?t=`/`?start=`/`#t=` を優先 → キーワード（Opening=0s, Boss=10–15s 等）→ 既定45s。
- **ダミー選択肢（初版）**: 同シリーズ/作曲者/年代から近傍を4択化。**正解は choices.* に必ず含める**。
- **難易度（初版）**: シンプル合成値（年代・別名密度など）。スケールは暫定（0–100 or small int）でよいが **数値** であること。
- **信頼性**: 公式チャンネル/レーベル優先。出典URLは `sources`（将来項目）に保持。

## DoD（v1.7）
- ローカル/CIで **harvest→score→enrich→generate→validate** が再現可能。
- `daily_auto.json` に**当日分**が存在し、`choices`/`difficulty` が埋まる（最低限の質保証）。
- `scripts/validate_authoring.js` が**構造/ユニーク/埋め込み整合**を確認して成功（CI緑）。

## 実行例（ローカル）
```bash
clojure -T:build publish
node scripts/harvest_candidates.js --out public/app/daily_candidates.jsonl
node scripts/score_candidates.js --in public/app/daily_candidates.jsonl --out public/app/daily_candidates_scored.jsonl
node scripts/enrich_media_start.js --in public/app/daily_candidates_scored.jsonl --out public/app/daily_candidates_scored_enriched.jsonl
node scripts/generate_daily_from_candidates.js --in public/app/daily_candidates_scored_enriched.jsonl --date $(TZ=Asia/Tokyo date +%F)
node scripts/validate_authoring.js
```

—  
*Started: 2025-09-05*

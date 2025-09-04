# Clip Start Heuristics v1

v1.7 で導入する **開始秒の自動推定** の最小ルールです。誤爆を避けるため、既存の `clip.start` がある場合は **既定では上書きしません**（`--force` のみ上書き）。

## 目的
- 埋め込み再生のみ（YouTube / Apple）という方針を守りつつ、**開始位置のばらつき**を減らす
- 完全自動運転の前段として **再現性のある単純ルール** を固定化

## ルール（優先順）
1. **既存 start を尊重**（`--force` がない限り維持）
2. **キーワードによる推定**
   - Opening/Prologue/Title/Main Theme/「序曲」「オープニング」「タイトル」→ `0`
   - Boss/Battle/Stage/Zone/Act/Level/Field/Dungeon/VS/「戦」「ボス」「ステージ」→ `12`
   - Ending/Credits/Staff Roll/「エンディング」「スタッフロール」→ `20`
3. **プロバイダ既定**
   - Apple → `15`
   - YouTube → `10`
4. 上記に当たらない場合は **既定 `45`**

> すべて `0 <= start <= 120` に clamp。`clip.duration` は未設定なら `15` を補います（UI側の上限 60 を尊重）。

## CLI
```bash
node scripts/clip_start_heuristics_v1.mjs \
  --in public/app/daily_candidates_scored_enriched.jsonl \
  --out public/app/daily_candidates_scored_enriched_start.jsonl \
  --default 45 --max 120
```

オプション:
- `--force`  … 既存の `clip.start` を上書き
- `--default` … マッチしなかったときの既定（既定 45）
- `--max` … 上限 clamp（既定 120）

## パイプラインへの組み込み
`enrich_media_start.js` 後、`generate_daily_from_candidates.js` の前に 1 ステップ追加します。

```bash
node scripts/harvest_candidates.js --out public/app/daily_candidates.jsonl
node scripts/score_candidates.js --in public/app/daily_candidates.jsonl --out public/app/daily_candidates_scored.jsonl
node scripts/enrich_media_start.js --in public/app/daily_candidates_scored.jsonl --out public/app/daily_candidates_scored_enriched.jsonl
node scripts/clip_start_heuristics_v1.mjs \
  --in public/app/daily_candidates_scored_enriched.jsonl \
  --out public/app/daily_candidates_scored_enriched_start.jsonl
node scripts/generate_daily_from_candidates.js \
  --in public/app/daily_candidates_scored_enriched_start.jsonl \
  --date $(TZ=Asia/Tokyo date +%F)
```

## テストの観点（最小）
- `Opening` を含むと `0` になる
- `Boss` を含むと `12` になる
- `Ending` を含むと `20` になる
- `apple` で `15` / `youtube` で `10` になる
- 既存 `clip.start=7` がある場合は上書きしない（`--force` でのみ上書き）

## 将来拡張（v2+）
- 音響解析（無音検出・ピーク・ビート）と組み合わせた補正
- プレイリスト/動画内のチャプターメタからの抽出
- QA からのフィードバックループ（bad start の学習）

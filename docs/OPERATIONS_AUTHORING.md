# OPERATIONS — Authoring (v1.7)

本書は v1.7「Authoring Automation（MVP）」の**運用ガイド**です。Docs が正本です。更新が必要になったらこのファイルを修正してください。

## 目的
- “毎日1問”の自動生成を **安全に** 運用する（まずは下書き→段階公開）。
- リポ汚染・誤公開を防ぐため、**validate（検証）**と**publish（PR）**を分ける。

## ワークフロー一覧
- **authoring (validate)** — 生成パイプラインを実行し、**構造/整合チェック**を行って **Artifacts に保存**。リポは更新しない。
- **daily (auto, candidates→score→generate)** — 生成パイプラインを実行し、`apply_to_main=true` のとき **`public/app/daily_auto.json` への PR を自動作成**（`false` なら Artifact のみ）。

## 推奨オペレーション
1. Actions → **authoring (validate)** を実行  
   - 入力: なし（Date は JST 今日に解決）  
   - 成果: `daily_candidates*.jsonl` と `daily_auto.json` が **Artifacts** に出力
2. 目視確認（曲・作曲者・メディア埋め込みの妥当性、choices/difficulty の粗チェック）
3. 問題なければ Actions → **daily (auto, candidates→score→generate)** を **apply_to_main=true** で実行  
   - 任意で `with_choices=true` / `allow_heuristic_media=true` を指定  
   - 結果: `public/app/daily_auto.json` の PR が作成され、既存設定があれば自動マージ

## トラブルシュート
- **PRが作成されない**  
  - `apply_to_main=true` になっているか確認  
  - リポに **`secrets.DAILY_PR_PAT`** が設定されているか確認（`peter-evans/create-pull-request` が使用）
- **メディア未解決（mediaOK=0）**  
  - allowlist/seed を増やす  
  - `allow_heuristic_media=true` を試す（安全な既定の範囲・45sガード付き）
- **重複/似問が多い**  
  - ⚙️ normalize/aliases の同期を確認  
  - 直近30日重複ガードは `daily_auto.json` 側で機能（詳細はスクリプト参照）

## ローカル実行（参考）
```bash
clojure -T:build publish
node scripts/harvest_candidates.js --out public/app/daily_candidates.jsonl
node scripts/score_candidates.js --in public/app/daily_candidates.jsonl --out public/app/daily_candidates_scored.jsonl
node scripts/enrich_media_start.js --in public/app/daily_candidates_scored.jsonl --out public/app/daily_candidates_scored_enriched.jsonl
node scripts/generate_daily_from_candidates.js --in public/app/daily_candidates_scored_enriched.jsonl --date $(TZ=Asia/Tokyo date +%F)
```

## 付記
- v1.7は **埋め込み再生のみ**（YouTube/Apple プレビュー）の原則を維持します。
- 公開手順は将来、`daily (auto)` の cron 化で自動化可能（まずは手動運用で検証）。


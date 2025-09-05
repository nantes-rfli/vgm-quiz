# Authoring Operations (v1.7)

本書は v1.7（Authoring Automation, MVP）の**日次運用手順**と**トラブルシュート**をまとめたものです。

## 1. 何ができる？
- 毎日 1 件の出題データを **自動生成 → 検証 → PR 作成 → 自動マージ**。
- 失敗しても **最低 1 件を保証**（`ensure_min_items_v1_post.mjs`）。
- 最終生成物は **by_date フラット形**で `title/game/composer/media/answers/norm` を保証。

## 2. パイプライン（GitHub Actions）
1) **harvest / merge**（候補統合）  
2) **score / enrich / clip-start**（属性付与・再生開始）  
3) **generate daily**（暫定の当日データ）  
4) **ensure_min_items**（空なら 1 件注入）  
5) **distractors_v1 / difficulty_v1**（選択肢補完・難易度付与）  
6) **finalize_daily_v1**（フラット形 + 必須フィールド補完）  
7) **validate**（`validate_nonempty_today` → `validate_authoring`）  
8) **export_today_slim**（検収用 `build/daily_today.json/.md`）  
9) **PR 作成 → Auto-merge**

> ジョブ: `authoring (heuristics smoke)` / `daily (auto extended)`

## 3. 見るべきアーティファクト
- `build/daily_today.md`：**人間読み**サマリ（タイトル、正答、メディア、難易度）
- `build/daily_today.json`：当日 1 件の JSON
- `public/app/daily_auto.json`：フル（過去分含む）

## 4. よくある詰まり・対処
- **当日が空で fail** → `merge_seed_candidates` が空でも `ensure_min_items` が補う。`sources/seed_candidates.jsonl` を 1–3 件追加すると安定。
- **バリデータで title/game/composer/norm が無い** → finalize が入っているか確認。`finalize_daily_v1` のログに `normalized by_date ...` が出ること。
- **PR が “check 待機”で止まる** → `auto-merge.yml` の権限/イベント/条件を確認（既知事例は docs/ISSUES にメモ）。

## 5. 手動実行
- Actions タブ → 該当ワークフロー → **Run workflow** → date 未指定で当日（JST）。

## 6. データ入力の増やし方
- `sources/allowlist.json`：チャンネル/パブリッシャの拡充（任意）
- `sources/seed_candidates.jsonl`：安全な候補（`provider:auto` も可）を数件ずつ追加

## 7. 日次チェックリスト（軽監視）
- `build/daily_today.json/.md` の当日 1 件を確認（**choices** が 1 or 4、欠損がない）
- **difficulty** が `0.00–1.00` の範囲に収まっている
- **media.provider / media.id** が存在（`?provider=auto&test=1&mock=1&autostart=1` で埋め込み可）
- **answers.canonical** が正規化済み
- Actions ログに `[difficulty] date=… values=[…]` の数値出力がある


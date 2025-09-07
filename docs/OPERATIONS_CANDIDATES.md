# 候補パイプライン運用（ingest → score → pick）

> ドキュメント言語は日本語（固有名詞/API名は英語可）

本番では **ローカル実行せず**、Actions だけで出題候補の取込・スコア付け・当日分の選出を行います。

## 1) ingest（候補の取り込み）
- Workflow: **candidates (ingest)**
- 入力: `sources/seed_candidates.jsonl`（必須） / `sources/allowlist.json`（任意）
- 出力: `public/app/daily_candidates.jsonl`（アーティファクト）
- オプション: `allow: on/off`（検証用。通常は `on`）

## 2) score（難易度付与）
- Workflow: **candidates (score+pick PR)** の内部ステップ（スクリプトは `scripts/score_candidates.js`）
- 入力: `public/app/daily_candidates.jsonl`
- 出力: `public/app/daily_candidates_scored.jsonl`（アーティファクト）

## 3) pick（当日の1問を選出して daily_auto.json に反映）
- Workflow: **candidates (score+pick PR)**
- ステップ: `scripts/generate_daily_from_candidates.js`
- 既存の `public/app/daily_auto.json` に**非破壊マージ**（30日近傍の重複を避けつつ最小難易度優先で選出）
- オプション:
  - `date`（JST, 省略時は当日）
  - `with_choices`（`true` で選択肢を付与）

## PR 自動作成
- `public/app/daily_auto.json` に差分がある場合、**自動PR** を作成（ブランチ: `feat/daily-from-candidates-<run_id>`）
- token: `secrets.CPR_PAT`（既存の aliases backfill と同様）
- labels: `automerge, daily, candidates`

## 典型フロー（手動運用）
1. **candidates (ingest)** を実行（通常 `allow: on`）
2. **candidates (score+pick PR)** を実行（`date` 未指定なら当日、`with_choices` 任意）
3. PR が自動作成される（差分が無ければスキップ）。保護ルールを満たせば自動マージ。

## 注意
- allowlist は最小から開始し、必要に応じて `sources/allowlist.json` を育てる運用。
- 非公式／埋め込み不可の検知は今後 **heuristic-media-guard** を導入予定（v1.9タスク）。
- `daily (ogp+feeds)` は OGP/Feeds のみ生成し、日別HTMLは作りません（仕様）。

## 関連ドキュメント
- `docs/COLLECTOR_V0.md`
- `docs/ALLOWLIST_SEED.md`

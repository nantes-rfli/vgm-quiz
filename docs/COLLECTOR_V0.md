# Collector v0（安全な候補収集・雛形）

## 目的
- 公式ソース（**Apple > YouTube公式 > その他**）を優先し、**allowlist と seed** から **再現性のある候補**を作る。
- 大規模クローリングは行わず、**JSONL キュー**にして下流に渡す。

## 出力
- `public/app/daily_candidates.jsonl`（1行=1候補、JSON）

## 仕様（v0）
- **入力**：`sources/seed_candidates.jsonl`、`sources/allowlist.json`（任意）
- **フィルタ**：allowlist により provider/id を簡易チェック（任意）。非公式/不明は除外。
- **重複排除**：`provider|id|answers.canonical` をキーに一意化（小文字・空白圧縮・ダッシュ統一・波チルダ統一）
- **整形**：`norm`（title/answer/composer/series/game）を補う。media が無くても可。
- **サマリ**：Step Summary に件数/除外理由を出力。

### 追加ガード（推奨）
- `scripts/heuristic_media_guard_v0.mjs`：provider/id 形式・title/answer 欠落など**明らかな不正**を除外（外部ネット無し）
- ワークフロー `candidates (score+pick PR)` に組み込み済み（ingest → **guard** → score → pick）

## 使い方
```bash
# 1) seed/allow を確認・編集
# 2) candidates (ingest) ワークフローを手動実行
# 3) アーティファクト daily-candidates をダウンロードして確認
```

## JSONL 行の例
```json
{
  "provider": "youtube",
  "id": "dQw4w9WgXcQ",
  "title": "Corridors of Time",
  "game": "Chrono Trigger",
  "answers": { "canonical": "Corridors of Time" },
  "norm": { "title": "corridors of time", "answer": "corridors of time", "game": "chrono trigger" },
  "media": { "provider": "youtube", "id": "dQw4w9WgXcQ", "start": 60 }
}
```

## 注意
- 著作権/埋め込み可否に配慮し、**公式のみ**を基本とする。
- allowlist は最小から開始し、運用で育てる。

## 関連
- `docs/ALLOWLIST_SEED.md`
- 既存: `scripts/harvest_candidates.js`、`merge_seed_candidates.mjs`、`score_candidates.js`、`generate_daily_from_candidates.js`

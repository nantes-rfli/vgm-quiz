# OPERATIONS: Discovery（dry-run）

## 目的
- **自動探索（Discovery）**を安全に段階導入するため、まず **dry-run** のみで提案 seed を生成し、レビュー可能なアーティファクトとして出力する。

## 入出力
- 入力: クエリ（ゲーム名 / アルバム名 / シリーズ名 等）
- 出力: `artifacts/discovery/proposals-YYYYMMDD-HHmm.jsonl`（**JSONL**、1行=1候補、書き込みは一切しない）

## ソース（v1）
- **iTunes Search** を起点にする（将来: Apple Music API / YouTube Data API を段階導入）。

## 正規化（最低限）
- `title`（曲名）, `game`（作品名）, `album`（任意）, `composer`（任意）, `release_date`（任意）
- `answers.canonical`: `title` を基本とした1要素配列（未確定のため暫定）
- `meta.provenance`（**6項目必須**）  
  `source`（"discovery"）, `provider`（"apple" など）, `id`（例: `"itunes:"+trackId`）  
  `collected_at`（ISO8601）, `hash`（title|game|album|composer を NFKC+lower→sha1hex）, `license_hint`（"preview"/"official"/"unknown"）

## 公式性の最小ルール（暫定）
- provider=apple の iTunes Preview → `license_hint:"preview"`（公式系）
- provider=youtube の公式チャンネル（将来対応）→ `license_hint:"official"`
- 不明な場合は `license_hint:"unknown"`

## De-dup v1.5（advice モード）
- 候補は**落とさず**スコアだけ付与（`dedup.theta`）。最終採否は Gate の θ で判断。

## Rate/Cost（方針）
- バースト回避: 1 QPS 程度（将来、Repo Variables で調整）
- リトライ: エラー時は指数バックオフ（max 3）
- キャッシュ: 同一クエリは 24h キャッシュ

## Step Summary（このIssueで出す項目）
- `official_rate`, `hit_rate`, `duplicate_ratio`, `fail_reasons_top3`  
  ※ Collector 全体のKPI章（QUALITY_KPIS.md）は別Issueで整備

## 手順（dry-run）
1. 手動実行（`workflow_dispatch`）でクエリ文字列を入力
2. 収集→正規化→provenance付与→de-dup (advice) を実施
3. **アーティファクト(JSONL)** をダウンロードしてレビュー（seedへは書き込まない）

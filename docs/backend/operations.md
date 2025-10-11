# Backend Specs – vgm-quiz
- Status: Draft
- Owner: （記入）
- Last Updated: 2025-10-09


# 運用（デプロイ・Secrets・監査）

## デプロイ
- Wrangler で `pipeline` / `api` を環境別デプロイ（staging/production）
- `wrangler secret` で最小権限トークンを登録

## Secrets（例）
- `DB`（D1）、`R2`（S3互換キー）、`ALIASES`（KV）、外部APIキー

## 監査・可観測性
- `audits` から スループット/失敗率/所要時間 を集計
- 失敗時通知は将来的にPager/Slackへ（当面はログダンプ）

## ロールバック
- Export は過去の `hash` を基準に R2 のバージョンを差し替え可能

# Observability & Alerts (Phase 3A)

ステータス: draft（環境未構築）

## 目的
- Pipeline/API Workers の Cron 失敗、D1/R2 エラー、/daily 5xx を 1 分以内に検知し Slack (#vgm-ops) へ通知する。
- 直近 24h の実行回数・処理時間・R2 書き込みサイズをダッシュボードで可視化する。

## 推奨構成（暫定）
- **ログ収納**: Cloudflare Logpush → Grafana Cloud Loki (Free/Trial で開始可)
- **可視化/アラート**: Grafana Cloud (Loki + Alerting)
- **通知**: Slack Incoming Webhook (#vgm-ops)

環境が未準備でもコードはフラグで無効化されるため、セットアップ完了後に有効化すればよい。

## 必要な環境変数（Workers）
- `OBS_ENABLED=true` でリモート送信を有効化（未設定/false の場合はローカルログのみ）
- `OBS_SLACK_WEBHOOK_URL` Slack Incoming Webhook URL（staging/prod で分ける場合はデプロイ環境別に設定）
- `OBS_SERVICE` 任意のサービス名（例: `pipeline`, `api`）。ログペイロードの `service` フィールドに反映。

## 実装メモ
- `workers/shared/lib/observability.ts` に構造化ログ/Slack 送信ヘルパーを追加。
- `OBS_ENABLED` が truthy の場合のみ Slack 送信を試行する。未設定でも動作を阻害しない。
- パイプライン Cron の主要イベント（start/ discovery / publish / end）で JSON ログを出力。エラー時は Slack 通知（有効時）。

## 動作確認
1. ローカル/CI でドライラン
   ```bash
   cd workers
   npm run observability:test
   ```
   - `OBS_ENABLED` 未設定の場合: 構造化ログのみ出力し、送信はスキップ。
   - `OBS_ENABLED=true` かつ `OBS_SLACK_WEBHOOK_URL` 設定時: Slack にテスト通知を送信。

2. 本番/ステージングでの有効化手順
   - Grafana Cloud で Loki Stack を作成し、Logpush からの Ingest URL/API Token を取得。
   - Cloudflare Logpush を R2 もしくは Direct Loki Push で設定（別途チケットで追記）。
   - `OBS_ENABLED=true`, `OBS_SLACK_WEBHOOK_URL=<workspace hook>` をデプロイ環境に設定。
   - `wrangler tail` で JSON ログが出力されること、Slack に通知が届くことを確認。

## 今後のタスク（Issue #134）
- Logpush → Loki ルートの具体化と Terraform 化
- Grafana ダッシュボード作成（Cron 成功率/平均 duration/R2 書き込みサイズ）
- Alert ルール定義（Cron 失敗・D1/R2 エラー・/daily 5xx）と Slack チャンネル分離方針の確定
- Runbook 追記：再実行・エスカレーション手順

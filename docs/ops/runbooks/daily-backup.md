# Runbook: デイリーバックアップ復旧

- **ステータス**: Phase 3D 初版
- **最終更新**: 2025-11-19
- **対象**: `GET /daily` が 404/5xx を返し canonical R2 (`exports/daily/`) が欠損した場合

## 目的

- `backups/daily/*.json` を活用して 14 日分以上の在庫を即時復旧する
- D1 (`picks` テーブル) ↔ R2 の不整合を 10 分以内に解消する
- バックアップ経由で配信している間はログに `api.daily.backup` を残し、復旧後に通常フローへ戻す

## 検知

| シグナル | しきい値 / 例 | 対応 |
|----------|---------------|------|
| Cloudflare Logs `publish.backup.put` 失敗 | status=fail が 1 回でも出たら | Slack #vgm-ops へ通知、自動再試行を確認 |
| API Worker ログ `api.daily.backup` (status=success) | 連続 3 回以上 | canonical 欠損を確認し Runbook を実施 |
| Grafana / 5xx アラート (`/daily`) | 1 分平均 > 5% | 即時バックアップ配信に切替 |

## 手順

### 1. 影響調査

1. Cloudflare Dashboard → R2 → `vgm-quiz-storage` → `exports/daily` の該当日付が存在するか確認
2. 同日付の `backups/daily/DATE.json` が存在するか `wrangler r2 object head` で確認
3. D1 整合性: `wrangler d1 execute vgm-quiz-db --remote --command "SELECT date, filters_json FROM picks WHERE date = 'YYYY-MM-DD'"`

### 2. バックアップ経由で暫定配信

1. API Worker で `GET https://<api-host>/daily?date=YYYY-MM-DD&backup=1` を実行しレスポンスを確認
2. フロントに告知する場合は `X-VGM-Daily-Source: backup` を根拠にする
3. Slack #vgm-ops に「BACKUP MODE: <date>」を投稿

### 3. 正規ストレージへの再配置

#### 3-a. D1 から再生成（推奨）

```bash
cd workers
npm run export:snapshot -- --start 2025-11-01 --end 2025-11-01
```

- 必須 env: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `--force` を付けると既存オブジェクトを上書き

#### 3-b. バックアップからコピー（D1 不整合時）

```bash
cd workers
npm run export:snapshot -- --start 2025-11-01 --end 2025-11-01 --source backup --force
```

- `--source backup` は `backups/daily/<date>.json` → `exports/daily/<date>.json` を R2 内部コピー
- コピー後に `wrangler r2 object head` で `exports/daily/<date>.json` を再確認

### 4. 検証

1. `GET /daily?date=YYYY-MM-DD`（backup パラメータなし）が 200 を返すか確認
2. API ログから `api.daily.backup` が発生していないことを確認
3. Pipeline Cron（次回実行）で `publish.backup.prune` が成功しているか監視

### 5. 事後対応

- Slack に復旧完了のメッセージ（復旧手段と所要時間を含む）
- 必要なら `docs/backend/r2-cache-strategy.md` の Lifecycle ルールや `BACKUP_PREFIX` を見直す
- 複数日に影響がある場合は `--end` を広げて一括リカバリ

## 参考ドキュメント

- [R2 Cache Strategy](../../backend/r2-cache-strategy.md)
- [scripts/export-snapshot.ts](../../workers/scripts/export-snapshot.ts)
- [API Spec: GET /daily](../../backend/api.md#1-get-daily)

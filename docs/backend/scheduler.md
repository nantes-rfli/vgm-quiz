# Backend Specs – vgm-quiz
- Status: Draft
- Owner: （記入）
- Last Updated: 2025-10-09


# スケジューラ（Workers Cron）

## 設定
- Discovery: `*/30 * * * *`（00/30分）
- Harvest: `5,35 * * * *`（Discovery 完了後 +5分）
- Guard/Dedup/Score/Publish: `0 15 * * *`（UTC 15:00 = JST 00:00）

### 環境変数で上書き可能な設定

| Key | Default | 用途 |
|-----|---------|------|
| `DISCOVERY_CRON` | `*/30 * * * *` | Discovery ステージの Cron 式 |
| `HARVEST_CRON` | `5,35 * * * *` | Harvest ステージの Cron 式（Discovery からのオフセット） |
| `PUBLISH_CRON` | `0 15 * * *` | Guard→Dedup→Score→Publish の連鎖起動時刻 |
| `POOL_COOLDOWN_DAYS` | `7` | Publish 後のクールダウン日数 |
| `CHOICE_DIFFICULTY_DELTA` | `10` | `generateChoices` が採用する難易度許容差 |

Wrangler では `vars` セクション、または環境ごとの `wrangler.toml` で値を調整する。`HARVEST_CRON` を変更した場合、Discovery の完了を待つために 5 分以上のオフセットを維持する。

## 実装
- `scheduled(event)` でステージを**直列**実行
- ステージ内で失敗→`audits.ok=false` 記録→早期終了
- 次回起動時に `audits` を参照して**未完ステージから再開**
- Discovery と Harvest は独立 Cron だが、Harvest は起動時に最新成功ジョブの `input_hash` を確認し、Discovery の処理中であれば次スロットまで待機するロジックを実装する（`audits` に `ok=false` か未完ジョブが残っていないかで判定）。

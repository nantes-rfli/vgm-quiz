# Runbook: コンテンツ自動収集 (Phase 4A)

ステータス: draft（PoC 実装前提）  
対象: YouTube → Spotify → Apple Music の Discovery / Harvest / Guard / Dedup → Publish ステージ

## 1. 前提設定
- Secrets: `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` を Cloudflare Workers Secret に登録。ローカルは `wrangler secret` を使用し `.env` には書かない。
- 観測基盤: `OBS_ENABLED=true`, `OBS_SLACK_WEBHOOK_URL` を本番/検証で設定。メトリクス名は `intake_*` 系を使用。
- ステージング: `INTAKE_STAGE=staging` をデフォルトにし、本番昇格は手動フラグで行う。
- カタログ: `SOURCE_CATALOG_JSON` に `docs/data/source_catalog.example.json` 形式の JSON を設定。デフォルトでは Git に含めず、Secret/Config 管理。
- フラグ: `INTAKE_ENABLED=true` を設定しない限り intake はスキップ（既存 Cron への影響を防止）。

## 2. 日次ジョブの流れ（PoC 期間）
1) 02:00 UTC: Discovery → Harvest → Guard → Dedup を実行（Publish は保留）  
2) 成功件数・失敗率・重複率を Slack #vgm-ops に自動ポスト（OBS 有効時）  
3) オペレータが結果を確認し、問題なければ Publish フラグを有効化して再実行または差分 Publish を実施

## 3. しきい値（暫定）
- LUFS: -22 〜 -10  
- 無音率: ≤ 3%  
- クリッピング率: ≤ 0.1%  
- Duration: 30s〜8m  
- メタ必須: `title`, `game`, `composer`（ISRC は任意だがあれば優先）
- **実装位置**: `workers/shared/lib/intake.ts` の `GUARD_THRESHOLDS` / `evaluateGuard`

## 5. 重複判定
- キー: `youtubeId`, `spotifyId`, `appleId`, 正規化タイトル+ゲーム名+作曲者の複合キー  
- 実装: `workers/shared/lib/dedup.ts` (`buildDedupKeys`, `buildCompositeKey`)  
- 優先度: ID マッチ > 複合キー。複合キーは正規化した文字列で一致した場合のみ採用。  
- Runbook: 重複率が 5% 超えたらソース優先度を見直し、同一プレイリストを 24h 除外。

## 6. Guard/Dedup 呼び出し位置
- Cron / `POST /trigger/intake` 内で playlist アイテム取得後に guard/dedup を実行（`workers/pipeline/src/stages/intake.ts` → `guardAndDedup`）。  
- 現状は YouTube snippet 由来で作曲者メタが欠損するため guardFail が多い。メタ補完ロジック実装後に通過率を改善し、しきい値を見直す。
- Duration 取得: YouTube videos API (`contentDetails.duration`) を `enrichYouTubeMeta` で秒数化。channelTitle を暫定 composer フォールバックとして付与。実データ確認後、メタ補完/辞書と差し替え予定。
- 追加フォールバック（staging 用）：playlist 名を game に、`videoOwnerChannelTitle`/`channelTitle` を composer にセット。prod 移行時は本物のメタ補完が揃い次第しきい値を戻す。
- Duration しきい値: prod は 30s〜8m、staging は下限 10s / 上限 12m に緩和（`evaluateGuard` で `INTAKE_STAGE` に応じて切替）。12m を超える長尺は除外対象（今回1曲のみ該当）。

## 4. フェイルオーバー / バックオフ
- API クォータ超過: 残ジョブを翌日に繰り越し、L3 → L2 → L1 の順で縮小。  
- 連続失敗 > 20%: ジョブを停止し、原因が解消するまで再開しない。Slack に ERROR 通知。  
- ソース単位で 3 回連続失敗した場合、そのソースを 24h ブラックリスト。

## 5. ロールバック
- Guard で落としたアイテムは `intake_guard_fail` ログに理由を記録し、再取り込み時に理由が変わらない限りスキップ。  
- Publish 前: ステージング R2/D1 のバッチをまとめて削除可能なように batch ID を付与。  
- Publish 後: D1 への適用履歴を Loki で追跡し、直近バッチを無効化するスクリプトを別途用意（TODO）。

## 6. 手動チェック項目
- Slack レポートで `intake_guard_fail_rate < 0.05`、`intake_harvest_fail_rate < 0.1` を満たすか確認。  
- 重複率: `dedup.duplicates / dedup.total < 0.05` を確認。  
- 代表サンプル 3 曲を再生し、音量・無音・メタ表示を目視確認。

## 7. よくある失敗と対処
- 429 / quota exceeded: ソース優先度を再配分し、再試行は翌日に限定。  
- LUFS 逸脱: しきい値を doc に従って更新し、再取り込み。  
- メタ欠損（ゲーム名なし等）: VGMdb/IGDB で補完してから再キュー。自動補完はまだ有効化しない。

## 8. 今後の TODO
- `source_catalog.json` の定義と管理手順を追加。  
- R2/D1 ステージング→本番の昇格スクリプトと CLI コマンドを用意。  
- ブラックリスト/除外リストの永続化場所を決定。  
- Apple Music intake: `APPLE_ENABLED=true` かつ Developer Token (`APPLE_MUSIC_TOKEN`), `APPLE_STOREFRONT` (デフォルト us) を設定し、playlist tracks を取得して guard/dedup へ流す（実カタログで検証要）。
- Spotify intake: `SPOTIFY_ENABLED=true` かつ Client ID/Secret 設定で playlist を取得し guard/dedup へ流す。Composer=先頭 Artist、Game=Album 名を暫定利用（要レビュー）。  
- Spotify artist: provider=spotify, kind=artist で top-tracks を取得し guard/dedup。マーケットは `SPOTIFY_MARKET`（未設定時 US）。
- Audio/LUFS 計測を後段で追加し、Guard しきい値再調整を予定。
- Guard/Dedup 超過時の通知: guardFailRate または duplicateRate が 0.2 以上で Slack 通知（`intake` ステージ内 `maybeAlertOnRates`）。- Guard/Dedup 超過時の通知: guardFailRate または duplicateRate が 0.2 以上で Slack 通知（`intake` ステージ内 `maybeAlertOnRates`）。
- Prod ガードの並走評価（任意）: `INTAKE_EVAL_PROD=true` で staging ガード後に prod しきい値（title+game+composer / 30s〜8m）を非同期評価し、`intake.guard_eval_prod` ログで pass/fail を確認（処理をブロックしない）。
- GuardFail 理由の集計を warn ログ出力（上位5件＋サンプル3件）。`intake.guard_fail` を確認し、欠損メタや duration 異常を優先的に補完する。
- Prod ガード並走評価: 常時 prod しきい値（title+game+composer / 30s〜8m）でも評価し、結果を `intake.guard_eval_prod` ログに記録（処理には影響させない）。

# Phase 4A: マルチソース自動収集 計画メモ（Plan フェーズ）

## ゴール
- YouTube → Spotify → Apple Music の順で Discovery / Harvest / Guard / Dedup パイプラインを構築し、日次取り込みを無停止化する。
- Phase 3 の観測性・ガードレールを流用し、失敗時に即検知・ロールバックできる状態を作る。

## 成功指標（Issue #147 と同一）
- 追加トラック数/週 ≥ 50
- 重複率 < 5%
- 取り込み失敗率 < 1%、MTTR < 15 分
- 品質監査パス率 > 95%

## スコープ
- ソース階層（公式 → レーベル → 高品質プレイリスト）定義とフェイルオーバー手順
- Discovery / Harvest の PoC（YouTube 先行）とメトリクス配線
- Guard / Dedup 実装方針（判定基準・ロールバック）
- Spotify 適用（ISRC・作曲者メタ補強）
- Runbook 下書きと日次スケジュール試験

## 非スコープ
- ML ベースの品質スコアリング（将来検討）
- Apple Music の本番化（評価までで止める）

## 依存・前提
- Phase 3 で用意した構造化ログ + Slack アラート基盤（`OBS_ENABLED`, `OBS_SLACK_WEBHOOK_URL`）
- R2/D1 への書き込み権限と日次 Cron 実行枠
- API キー/OAuth 秘匿管理（Workers Secrets）。ローカル検証用に `.env.local` ではなく `wrangler secret` を利用
- `workers/shared` にメタ正規化・検証ユーティリティを追加可能であること

## ソース階層と除外基準（ドラフト）
| 層 | 例 | 優先取り込み条件 | 除外基準 | フェイルオーバー |
|---|---|---|---|---|
| L1 公式 | 公式チャンネル / OST 公式配信 | 権利元公式、タイトル/作曲者/ゲーム名が明示 | 収益化不可フラグ、低音質(<=96kbps相当) | L2 へ降格 |
| L2 レーベル | 公認レーベル・出版 | メタ完整度 ≧ 80% (タイトル/ゲーム/作曲者/ISRC のうち 4/5) | 重複疑い、無音率 > 5% | L3 へ降格 |
| L3 高品質プレイリスト | 再生数・保存数が高いファン/キュレーション | LUFS -22〜-10、無音率 ≤ 3%、タイトルにゲーム名含む | 権利警告、LUFS逸脱、メタ欠損 | 当日スキップ（翌日リトライ） |

※ LUFS/無音率は Guard ステップで実測し、しきい値は PoC 中にチューニングする。

## パイプラインフロー（PoC → 本番化）
1) **Discovery**: ソースリスト取得（YouTube PlaylistItems/Channels）。入力: `source_catalog.json`（今後追加予定）。出力: raw candidate items。  
   - フィルタ: 公開範囲・再生時間 30s〜8m。  
   - Side metrics: `discovery.count`, `discovery.filtered`.
2) **Harvest**: メタ + オーディオ試料取得（動画情報 / 音声ダウンロード or URL 抽出）。  
   - タイムアウト 8s/アイテム、最大並列 3。  
   - 失敗は指数バックオフ（2, 4, 8 分）で最大 3 回。
3) **Guard**: 品質/ライセンスチェック。  
   - LUFS・無音率・ピーククリップ率、ビットレート推定。  
   - メタ完整度（タイトル/ゲーム/作曲者/ISRC/発売年）。  
   - 成功: `guard.pass`; 失敗: `guard.fail` に理由付与。
4) **Dedup**: 既存ストックとの差分抽出。  
   - キー: `youtube_video_id` | `isrc` | 正規化タイトル+ゲーム名+作曲者（Levenshtein 0〜1 以内）。  
   - 重複時は `duplicate_of` を記録し、新規採用しない。  
   - Side metrics: `dedup.duplicates`, `dedup.unique`.
5) **Publish (試験)**: 合格トラックを R2 一時バケット + D1 ステージングテーブルに格納。  
   - フラグ `INTAKE_STAGE=staging` で本番セットとは分離。  
   - 1 日あたりの最大書き込み件数を 120 に制限し、 キューレーション用に batches を分ける。

## ガード判定の初期しきい値（PoC 時点の目安）
- LUFS: -22 〜 -10
- 無音率: ≤ 3%（動画開始前のサイレンス除外）
- クリッピング率: ≤ 0.1%
- Duration: 30s〜8m
- メタ必須: `title`, `game`, `composer` の 3 つが揃うこと。`isrc` はあれば 1 次キーに追加。
→ 実測でしきい値を再調整し、Runbook に確定値を書く。

## メトリクス / アラート接続（Phase 3 基盤を流用）
- ログイベント: `intake_discovery`, `intake_harvest`, `intake_guard`, `intake_dedup`, `intake_publish`（各 stage に status / reason を付与）
- 失敗率しきい値（初期案）: `intake_guard_fail_rate > 0.05` または `intake_harvest_fail_rate > 0.1` で Slack #vgm-ops に WARN、`>0.2` で ERROR
- MTTR 計測: 失敗イベントから成功イベントまでの差分を Loki/Grafana で計算
- Duplicates: 日次 `dedup.duplicates / dedup.total < 0.05` を下回らない場合に WARN

## スケジュールとクォータ管理（YouTube 先行案）
- 毎日 02:00 UTC に Discovery → Guard までを実行、Publish は手動承認フラグで開始（PoC 期間）
- YouTube Data API クォータは 1 日 10k を上限と仮置きし、PlaylistItems/Channels 取得に 60%、Video 詳細に 40% を割り当てる（正確な上限はキー発行後に再計測）
- クォータ超過時: 残りは翌日に持ち越し、L3 から順に縮小

## Runbook 下書き（作成予定の項目）
- 収集クォータ枯渇時の対応（枠再配分 / 翌日スキップ）
- 権利警告・DMCA 検知時の自動停止と再開手順
- ガードしきい値変更手順（`workers/shared` の定数更新 → deploy）
- R2/D1 ステージングから本番ストックへの昇格手順

## 初期実装タスク（ブレークダウン）
- [x] ソースカタログ草案（L1/L2/L3 と除外基準）を `docs/data/curated-sources.md` に追記
- [x] Discovery/Harvest PoC（YouTube/Spotify）：最小ジョブ + 構造化ログ出力、メトリクス名確定（intake.*）
- [x] Guard/Dedup 実装：LUFS・無音率・メタ完整度の検証ユーティリティと重複判定キー（音声計測の実装は残タスク）
- [x] Spotify 適用：artist top-tracks (market=JP) を本番しきい値で通過確認、フェイルオーバーは次サイクルで調整予定
- [ ] Apple Music intake 実装・検証
- [x] Runbook 初版（クォータ枯渇・権利警告・ロールバック）
- [ ] 日次スケジュール試験：staging フラグ付きで 2〜3 日連続実行し、指標トラッキングを確認

### 進捗メモ
- ガード判定の共通ユーティリティを `workers/shared/lib/intake.ts` に追加（LUFS/無音率/クリップ率/長さ/メタ完整度のスコアリング）。今後の Guard ステージで再利用する。
- Dedup キー生成ユーティリティを `workers/shared/lib/dedup.ts` に追加（YouTube/Spotify/Apple ID 抽出とタイトル+ゲーム+作曲者の複合キー生成）。
- Intake ステージに Guard/Dedup 呼び出しを組み込み、YouTube playlist snippet ベースで guard/dedup ステータスをログ出力（現状は作曲者メタ欠損のため guardFail が多く、メタ補完後に有効化想定）。
- YouTube videos API を使った duration/composer(channelTitle) 付与を追加（`enrichYouTubeMeta`）。メタ補完後に guard 通過率をモニタリング予定。
- Spotify playlist 取り込みの PoC を追加（`SPOTIFY_ENABLED` フラグ＋ClientID/Secret）。Composer=先頭 Artist、Game=Album 名、ISRC と duration を guard/dedup に渡す。
- Spotify artist intake を追加（provider=spotify, kind=artist）。マーケットは `SPOTIFY_MARKET`（未設定時 US）の top-tracks を取得して guard/dedup へ流す。
- Apple Music intake は未実装。`APPLE_ENABLED` フラグと `APPLE_MUSIC_TOKEN` 構成を追加済みで、実装時にフェイルオーバーへ統合予定。
- Guard/Dedup 超過時に Slack 通知を追加（fail/dup rate ≥ 0.2 で WARN）。
- Prod ガード並走評価を常時実行し、`intake.guard_eval_prod` で pass/fail をモニタ（処理には影響させない）。
- staging では必須フィールドを title のみに緩和し、playlist 名を game、channelTitle を composer にフォールバックさせて通過率を確認済み（89件中88件 pass）。prod では元の閾値 0.8・必須 title+game+composer に戻す予定。
- GuardFail 理由の上位5件＋サンプル3件を warn ログに記録するようにし、補完/しきい値調整の判断材料を残す。
- Duration しきい値（staging）を 10s〜12m に緩和し、短尺で落ちていた 1 曲を許容。prod は 30s〜8m のまま。

## 決めたいこと（レビュー用）
- LUFS/無音率しきい値の最終値を誰が承認するか
- R2/D1 ステージングのデータ保持期間（提案: 14 日）
- Publish 前の人手レビューを続けるか、バッチ単位で自動昇格するか

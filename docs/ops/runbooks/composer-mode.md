# Composer Mode / Adaptive Gameplay Rollback Runbook

目的: 作曲者モード (Adaptive Gameplay Phase 4B) で異常が発生した場合、迅速に無効化・切り戻しを行う手順をまとめる。

## トリガー条件（例）
- composer メタ欠損率が 5% を超え、Slack アラートが発火した。
- 完走率/再訪率の主要指標が Control より悪化し、A/B 監視で危険しきい値を下回った。
- Rounds API で mode=vgm_composer-ja が 5xx/404 を頻発。

## 即時対応（無効化手順）
1) Cloudflare Workers 環境変数を OFF にする
- `COMPOSER_MODE_ENABLED=0` を workers/api と workers/pipeline 両方の環境に設定し再デプロイ。
- フロントは manifest.features.composerModeEnabled=false となり、モード選択 UI が非表示になる。

2) 既存 composer エクスポートを出題対象から外す
- フラグ OFF 後は新規リクエストで composer モードは選択不可。既存トークンを持つユーザーがいる場合、API は 404 を返すため影響が出る可能性がある。必要なら CDN で `/v1/rounds/start` に対し mode=vgm_composer-ja のリクエストを 400/410 で短絡するルールを追加。

3) Slack / PagerDuty 連携（任意）
- 運用チャネルに「composer mode disabled (flag off)」を周知。

## 切り戻し（再開）
- `COMPOSER_MODE_ENABLED=1` を再設定しデプロイ。
- パイプライン cron/`/trigger/publish?mode=vgm_composer-ja` で composer セットが再生成されることを確認。

## 検証チェックリスト
- `/v1/manifest` の `features.composerModeEnabled` が想定通り (true/false) になっている。
- `/v1/rounds/start` に mode を指定した際のレスポンス/エラーコードが切り替わっている。
- Slack アラート（欠損率>5%）が正常に発火/収束している。

## 影響範囲と後処理
- フラグ OFF 中は composer モードが UI/manifest から消える。通常モードの KPI には影響なし。
- 既存 composer ラウンドのトークンは継続できないため、ユーザー影響が懸念される場合は一時的にモード用 R2 エクスポートを退避し、再開時にそのまま利用する。

## 連絡先
- オーナー: Phase4B 担当 (nantes-rfli)
- Slack: #vgm-ops

# OPERATIONS_DAILY_ONEQ（“1問/日” 自動MVP 運用手順）

## 目的
毎日1問を**埋め込みのみ**で安全に配信する。失敗時の復旧を迅速・確実に行う。

## 前提
- 唯一の正は `docs/issues/*.json`。`validate → ids assign → sync → export` で上書き同期。
- 再生は **Apple優先→YouTube**。自前配信は常に禁止。

## 定常運用
- `Actions: daily (oneq)`（名称は実装時の実ジョブ名に合わせる）を**スケジュール**＋**手動トリガ**可。
- 成果物: `public/daily/YYYY-MM-DD.json`（または同等の生成物）と OGP/Feeds。
- Summary で KPI を確認（成功率・生成LT・メディア解決率・重複拒否件数・ゲート余裕度）。

### media_map（埋め込み用IDの管理）
- 埋め込み先ID（Apple/YouTube）は `docs/data/media_map.json` で管理（JSON配列）。
- スキーマ: `{ "track_id": "<datasetの track/id>", "provider": "apple|youtube", "id": "<埋め込みID>" }`
- 本番CIではネットワーク解決を行わない前提（法務と安定性のため）。`media_map.json` はPRで更新し、レビュー可能な形で履歴を残す。

## 失敗時の復旧
- **A. 手動再実行**: フレーク要因の場合はリトライ。Artifacts を確認して原因を要約し、Issue に `notes` として残す。
- **B. 強制 skip**: Apple/YouTube いずれも解決不可の場合は当日を skip。次回に繰越されることを Summary に明記。
- **C. ロールバック**: 直前PRで壊れた場合は Revert→再実行。必要なら `ids assign → sync → export` を明示再実行。

## よくある原因と対処
- **メディア未解決**: プロバイダ探索のリトライ回数・タイムアウトの上限を確認。NGなら skip 運用。
- **重複検出**: 一意性ロックの期間や閾値を確認。誤検知が疑われる場合は `notes` に根拠と値をメモ。
- **OGP/Feeds失敗**: PAT/権限を確認。テンプレ差分は `docs/` に記録（PRテンプレ／OGP設定）。

## ログ・証跡
- KPI（固定スキーマ）を Actions Summary に出力。
- 主要アーティファクト（生成JSON/OGPカード/ログ要約）を保存。

## 禁止事項
- 自前配信（バイナリ直配）への回帰。
- Docs を更新せずに実装・設定変更を行うこと。


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

## 公開フロー（publish）
- Actions: **daily (oneq preview)** … 1件を pick し、`out/daily-YYYY-MM-DD.json` をアーティファクトとして出力（コミットなし）
- Actions: **daily (oneq publish)** … 1件を pick し、`public/daily/YYYY-MM-DD.json` を生成、`docs/data/daily_lock.json` に追記し、**PR を自動作成**
- PR をレビューしてマージすると、Pages に `public/daily/YYYY-MM-DD.json` が公開される

### PR作成と必須チェックの起動（PAT設定）
- `daily (oneq publish)` の PR で **必須チェック（ci-fast-pr-build / pages-pr-build / required-check）** が「Expected」のまま動かない場合、`GITHUB_TOKEN` では後続ワークフローが起動しない設定になっています。
- 本ワークフローは **`DAILY_PR_PAT` を優先**し、未設定なら **`CPR_PAT`** をフォールバックして使います。
  - 既存のどちらかを **Settings → Secrets and variables → Actions** に登録してあれば追加作業は不要です。
  - **クラシックPAT**: `repo` + `workflow` スコープ（推奨: 期限付き）
  - **FGT（細分化）**: 対象リポに対し *Contents: Read/Write*, *Pull requests: Read/Write*, *Actions: Read/Write*
- 既に作成済みの PR は、`daily (oneq publish)` を**再実行**すると同ブランチへ新規コミットが積まれ、必須チェックが起動します。

### 自動マージの有効化
- 本ワークフローは PR 作成後に **auto-merge（squash）を自動で有効化**します。
- リポジトリ設定で **Allow auto-merge** を ON にしてください（Settings → General）。
- ブランチ保護で「レビュー必須」などの条件がある場合は、条件を満たした時点で自動的にマージされます。

### Pages 反映がたまにキャンセルされる問題（簡素化で回避）
- `Pages` ワークフローが **push** と **workflow_run(CI Fast)** の2経路で二重起動し、concurrency で競合→片方が `canceled` になる事がある。
- **対策（推奨）**: `pages.yml` のトリガを **push: main** と **workflow_dispatch** のみに**単純化**。  
  - `workflow_run: CI Fast` は削除（他のデイリー系も push→Pages に寄せる運用のため）
  - PR 時の必須チェックは `pages-pr-build.yml` の **shim** が満たす（実デプロイは main に入ってから）

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


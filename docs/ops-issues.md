# Issues 運用ガイド（sync / export）

このドキュメントは `docs/issues/*.json` による **自動Issue登録** と、`docs/issues/STATE.md` の **スナップショット出力** の運用手順です。

## 1) 登録（sync）
- 変更点を `docs/issues/*.json` に書く（PRは Codex 経由でOK）
- マージで **issues (sync)** が走り、タイトル一致 or `id` 一致で **作成/更新**
- ラベルが無ければ自動作成

### `id` の利用（推奨）
- JSONに `id`（例: `ui-choices-grid`）を付けると、Issue本文に `<!-- issue-id: ui-choices-grid -->` が埋め込まれ、**タイトル変更後も同一Issueを更新**できます。

## 2) 状態の共有（export）
- Actions → **issues (export)** を実行（または日次自動）
- `docs/issues/STATE.md` と `state.json` を出力する **PRを自動作成 → 自動マージ**
- シークレット: `CPR_PAT`（Fine-grained PAT; Contents:RW / Pull requests:RW）

## 3) 失敗時の対処
- sync が失敗: JSON構文や必須フィールドを確認。PR時に **issues (validate)** でチェックされます。
- export が失敗: `CPR_PAT` の失効/権限を確認。Ruleset で PR 必須/Required checks は許可済みでOK。

## 4) ルール
- **正本は docs/**（Issuesを直接編集した場合、次回syncでJSONに同期されます）
- ラベルは `roadmap:*` / `area:*` / `type:*` を基本とし、増やす場合は意味と色を定義


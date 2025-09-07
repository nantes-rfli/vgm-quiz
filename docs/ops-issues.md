# Issues 運用ガイド（sync / export）

このドキュメントは `docs/issues/*.json` による **自動Issue登録** と、`docs/issues/STATE.md` の **スナップショット出力** の運用手順です。

## クイック手順（作成・更新の順番）
1. **編集**：`docs/issues/*.json` を追加/更新（`title/labels/body` 必須、`id` 推奨、`state` 任意）
2. **検証**：Actions → **issues (validate)**（PR時は自動）で JSON 体裁をチェック
3. **id 付与（任意）**：Actions → **issues (ids assign)** を実行  
   - 付与PRは自動作成→自動マージ（`CPR_PAT` が必要）
4. **同期**：Actions → **issues (sync)** を実行（または `docs/issues/*.json` を main にマージ）  
   - 既存Issueは `id`（本文埋め込み） or タイトルで一致更新／無ければ新規作成  
   - `state` 指定があれば **open/closed** を反映
5. **スナップショット**：Actions → **issues (export)** を実行  
   - `docs/issues/STATE.md` / `state.json` を更新するPRが自動作成→自動マージ

> v1.9 以前の **未作成Issue** も、該当する JSON に追記してから上記 2→3→4→5 で一括反映できます。

## 1) 登録（sync）
- 変更点を `docs/issues/*.json` に書く（PRは Codex 経由でOK）
- マージで **issues (sync)** が走り、タイトル一致 or `id` 一致で **作成/更新**
- ラベルが無ければ自動作成

### `id` の利用（推奨）
- JSONに `id`（例: `ui-choices-grid`）を付けると、Issue本文に `<!-- issue-id: ui-choices-grid -->` が埋め込まれ、**タイトル変更後も同一Issueを更新**できます。

### `state` の指定（任意）
- 各要素に `state` を付けると、Issueの**状態（open/closed）**も同期できます。
```jsonc
{
  "id": "ui-choices-2-3-4",
  "title": "UI: #choices グリッド2→3→4列のレスポンシブ",
  "labels": ["roadmap:v1.5","area:ui","responsive"],
  "state": "closed",
  "body": "…"
}
```
> `state` を省略した場合は従来通り、タイトル/本文/ラベルのみ更新します。

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


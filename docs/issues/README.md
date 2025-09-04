# Issues sync & snapshot

`docs/issues/*.json` にIssueの雛形を置き、GitHub Actionsで **自動登録/更新** します。
さらに、GitHub上のIssue状況を **スナップショット** として `docs/issues/STATE.md` / `state.json` に書き出せます。

## 使い方（Sync）
- 追加/変更したいIssueは `docs/issues/*.json` を編集してPR（Codex経由でOK）
- マージするとワークフローが走り、**タイトル一致**で既存Issueを更新 or 新規作成
- ラベルが無ければ自動作成（色は仮）
- 手動実行: Actions → **issues (sync)** → Run workflow

## 使い方（Snapshot）
- Actions → **issues (export)** を実行 or スケジュール発火（UTC 15:00 ≒ JST 00:00）
- `docs/issues/STATE.md` と `docs/issues/state.json` が更新されます
- 以後、zip を渡すだけで、最新のIssue状況を外部から把握可能

> 運用ルール（推奨）: 正本は docs/。GitHubのIssue編集は基本せず、JSON→PRで同期する。

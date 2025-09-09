# Troubleshooting

## YAML / GitHub Actions
- **bad indentation of a mapping entry**: `- name:` 直下の `if:` / `run:` のインデントを揃える。`run: |` を使い複数行 echo を推奨。
- **if に URL を置いてしまう**: `if: ${{ steps.cpr.outputs['pull-request-url'] != '' }}` のように真偽式にする。
- **ハイフンキーの outputs**: かならず `['...']` で参照（例: `steps.cpr.outputs['pull-request-url']`）。

## /daily の挙動
- すぐリダイレクトして検証できない → `?no-redirect=1` を付与。
- 遅延させたい → `?redirectDelayMs=1500` を付与。
- 当日分が 404 → `daily.json generator (JST)` の実行状況を確認。

## AUTO が反映されない
- `?auto=1` が付いているか、曲の正規化一致があるかを確認。
- 検証では `&auto_any=1` を併用。

## PR が作られない
- 差分が無い場合は正常。Summary に `(no changes / not created)` が出る。


## Required が「待機中」から進まない（自動PR）
- 自動PRを **GITHUB_TOKEN** で作成すると、状況によって `pull_request` ワークフローが**発火しない**ケースがあります。
- 対処：
  1. PR作成は **Fine-grained PAT (`CPR_PAT`)** を使用（`peter-evans/create-pull-request` の `with.token`）。
  2. PRブランチは毎回ユニーク（`bot/apple-enrich-${{ github.run_id }}`）。
  3. 既存PRが“待機中”なら **Close→Reopen** または **空コミット**（`git commit --allow-empty && git push`）で再通知。
- Pages/CI/E2E の **Required 名**（`pages-pr-build` / `ci-fast-pr-build` / `required-check`）と **Job名** が一致しているかも点検。

## PR が自動マージされない（Auto-Enable PR Auto-Merge が skipped）
- セキュリティ上、`.github/workflows/**` を変更する PR では自動マージを**無効化**しています（コメントのみ）。
- それ以外の PR でも、作成主体やブランチ名で条件に合わないと **enable ジョブが skip** されます。

### collector 由来の PR を自動マージしたい
- ブランチ名が `collector/` で始まる、またはタイトルに `Collector Gate` を含む PR については、
  `Auto-Enable PR Auto-Merge / enable (collector)` が `CPR_PAT` で **auto-merge を有効化**します（squash）。
- 既存 PR に適用するには、**ラベル追加**または **Close→Reopen**（`pull_request_target` を再発火）してください。

## PRが「Some checks haven't completed yet」で止まる（Required チェックが起動しない）

### 症状
- create-pull-request で作った PR に Required チェックが付与されるが、**ステータスが報告されない**（ずっと待機）。

### 原因
- `GITHUB_TOKEN` で作成された PR だと、組織やリポのポリシーにより **ワークフローがトリガーされない**設定になっていることがある。

### 対応（推奨）
1. **PAT（Personal Access Token）** を作ってリポジトリの Actions Secrets に保存：`CPR_PAT`
   - Classic PAT: `repo`, `workflow` スコープを付与
   - Fine-grained PAT: **Contents: Read/Write**, **Pull requests: Read/Write**, **Actions/Workflows: Write** 相当
2. ワークフローで `peter-evans/create-pull-request@v6` の `with.token` に `secrets.CPR_PAT` を指定
3. 既に作成済みの PR は **Close → Reopen** するか、空コミットを push してチェックを再起動

> 本パッチで `collector (gate from artifact by id - REST)` は `CPR_PAT` を使用するよう更新済み。

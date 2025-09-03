# Ops Runbook

## Manual deploy (Pages)

Open **Actions → Pages → Run workflow** (branch: `main`) to redeploy `public/`.

## Daily PR at 00:00 JST

Check **Actions → daily.json generator (JST)**. The PR should include:

- `public/app/daily.json`
- `public/daily/*.html`
- `public/daily/feed.xml`

Author must be **you** (PAT owner), not `github-actions[bot]`. If bot appears:

- Update `DAILY_PR_PAT` secret (create a fresh PAT; repo scope)
- Re-run the workflow.

## Empty deploy (to test SW update)

```bash
git switch main && git pull --ff-only
git commit --allow-empty -m "chore(pages): redeploy"
git push origin main
```

## Health checks (5-min)

- `/daily/index.html` → **200**
- `/daily/latest.html` → **200** and redirects to `./YYYY-MM-DD.html` (share page)
- `/daily/feed.xml` → **200**
- Footer (commit / updated) reflects latest deploy

## E2E (matrix)

Suites: `smoke`, `a11y`, `footer`, `share`, **`normalize`**, **`lives`**

## Lighthouse

Nightly run (desktop). Budgets & asserts enabled.

- View the job **Summary** for the temporary-public report URL.
- Artifact **lighthouse-report/report.html** is saved for 7 days.

### アセットスキャン（GitHubでの実行）
- **手動実行**: Actions → **asset-scan (on-demand & PR)** → Run workflow
- **PRトリガ**: `public/**` 等に変更があるPRで自動実行し、結果を Job Summary とPRコメント・Artifact に出力
- **削除フロー**: 出力の候補をレビュー → 不要なら削除PRを作成 → E2E / Pages / lighthouse を確認

### アセットの未使用チェック（スキャン）
- コマンド: `npm run scan:assets`
- 仕組み: `public/` 配下の画像/フォント/音声を列挙し、リポ内のテキストから参照をグリッドサーチ。参照が見つからないものを候補として出力（**自動削除はしない**）。
- 使い方: まず候補をレビュー → 問題なければ手動削除し、E2E/Pagesを確認。

### latest.html（運用メモ）
- 生成物は **JS リダイレクト（`location.replace('./YYYY-MM-DD.html')`）** 方式でも良い（従来の `<meta http-equiv="refresh">` も可）。
- E2E（`e2e/test_share.js`）は **meta / JS / `<a href>`** のいずれかで当日（JST）への遷移を検出するように緩和済み。
- 手動実行直後などタイミング差がある場合、**前日**への遷移も暫定許容（後続の daily 実行で当日化される前提）。
- CDN/Pages キャッシュを避けるため、検証時は `?e2e=<timestamp>` と no-cache ヘッダで取得する。

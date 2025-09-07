# Docs Index

> vgm-quiz の開発・運用ドキュメントのハブです。迷ったらまず **HANDBOOK** へ。

## Handbook
- [VGM Quiz Handbook](HANDBOOK.md)

## Architecture / Pipelines / Ops
- [Architecture (high-level)](architecture.md)
- [Pipeline overview](pipeline.md)
- [ops / runbook](ops.md)
- [docs architecture](docs-architecture.md)
- [Ops Tips](ops-tips.md)
- [Troubleshooting](troubleshooting.md)
- [Release checklist](release-checklist.md)
- [Glossary](glossary.md)
- [URLs & Query Params](urls-and-params.md)
- [labels](labels.md)
- [ci overview](ci.md)

## QA / Monitoring
- [e2e (daily share & latest smoke)](e2e-daily-pages-smoke.md)
- [e2e (auto badge smoke)](e2e-auto-badge-smoke.md)
- [e2e (light regressions)](e2e-light-regressions.md)
- [lighthouse (budgets, nightly)](lighthouse-budgets.md)

## CI Status
- [CI / Ops バッジ一覧](ci-status.md)

## Changelog
- [CHANGELOG.md](../CHANGELOG.md)

## Writing
- [Docs Style Guide](STYLEGUIDE.md)

## ドキュメント更新の流儀（最小）

- **正本（canonical）を先に直す**  
  パラメータ/URL/フラグは `docs/urls-and-params.md` が正本。ここを更新 → 実装/テストを追従。

- **整合の三段**  
  `FEATURES.yml（planned）` → `docs/ROADMAP.md` → `docs/urls-and-params.md` の順で整合を取る。

- **廃止は ARCHIVE へ**  
  古い/重複ドキュメントは `docs/ARCHIVE.md` に記録して削除（再追加しない）。

- **自動ガードを味方に**  
  - docs-enforcer: コード変更PRに docs差分が無いと **fail**（`docs:skip` 可）。  
  - roadmap-guard: `FEATURES.yml` の planned が ROADMAP に無いと **警告**。  
  - docs-legacy-guard: 旧ファイルの再導入は **警告**。

- **PRチェック（最小）**
  1) 正本の更新有無（`urls-and-params.md` 等）
  2) ROADMAP/FEATURES の drift 無し
  3) 古い docs の再導入無し（ARCHIVE に追記済み）
  4) 変更に応じて E2E / Budgets の説明を必要最小限で更新

## ドキュメント言語ポリシー
本リポジトリのドキュメントは **日本語に統一** します（固有名詞・API名・エラー文などは英語表記可）。  
新規追加・更新時は日本語で記述し、英語ドキュメントを追加する場合は別ファイルにせず原則日本語へ統合します。

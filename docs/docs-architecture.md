# Docs Architecture

> **目標**: ドキュメントの“正本”を明示し、古い文書が混ざっても迷わない構造にする。

## Canonical（正本）

| 種別 | 正本 |
|---|---|
| 概要 / 入口 | `README.md`, `docs/README.md` |
| パラメータ仕様 | `docs/params.md`（網羅）、`docs/urls-and-params.md`（抄） |
| ロードマップ（物語） | `docs/ROADMAP.md` |
| 機能在庫（機械可読） | `docs/FEATURES.yml` + `docs/FEATURES.md` |
| 運用 | `docs/ops.md` |
| CI / E2E | `docs/ci.md`, `docs/ci-status.md`, 各E2Eの解説 |
| 変更履歴 | `CHANGELOG.md` |

## 置き換えルール（代表例）

| 旧/紛らわしいファイル | 状態 | 移行先 |
|---|---|---|
| `PROJECT_STATUS.md` | **廃止**候補 | `docs/ci-status.md`（CI状況）＋ `docs/ROADMAP.md`（計画） |
| `STATUS.md`, `docs/status.md` | **廃止**候補 | 同上 |
| `ROADMAP_old.md`, `ROADMAP_*.md` | **廃止**候補 | `docs/ROADMAP.md` |
| `TODO.md` | **廃止**候補 | GitHub Issues / Projects |
| `NOTES.md`, `notes/*.md` | **任意**（検討） | 有用なら `docs/` 配下へ統合、不要なら削除 |

> 実在しない場合もあります。**存在したら上記へ統合**してください。

## ガードレール

- **docs-enforcer**: コード変更のPRにドキュメント差分がなければ **fail**（`docs:skip` で除外可）
- **roadmap-guard**: `FEATURES.yml` の `planned` が `ROADMAP.md` に見当たらないと **警告コメント**（非ブロッキング）
- **docs-legacy-guard（本パッチで追加）**: 旧/紛らわしいファイルがPRに含まれていたら **警告コメント**（非ブロッキング）

## 運用Tips

- 新機能をPRで入れるときは、**FEATURES.yml → ROADMAP.md → docs/params.md** の順に整合を取ると漏れにくい。

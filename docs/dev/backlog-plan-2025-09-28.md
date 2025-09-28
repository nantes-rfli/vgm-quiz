# Backlog Plan (2025-09-28)

## 合意事項メモ

- README 系タスクとテストノート作成を含む「ドキュメント整備パス」から着手する。
- `data/questions.v1.json` はモック固定値とは別に正式データを準備する（#29）。
- `docs/frontend/testing-notes.md` は UI 開発者が参照するナレッジ置き場とし、`docs/quality/e2e-plan.md` とは役割を分ける。
- API 型とフィクスチャの整合は `Question.artwork` を型定義へ追加して合わせる方針。
- #31/#30 は #29 完了をブロック条件として Issue コメントで明示する。
- #27/#37/#28 は Backlog/Icebox へ優先度調整の上で後続検討。
- #34/#11 は完了ステータスへ移し、クローズ予定。

## 今後の作業順序

1. ✅ ルート `README.md` と `web/README.md` をプロジェクト仕様に更新。（#67 で実施済み）
2. ✅ `docs/frontend/testing-notes.md` を新規追加し、関連ドキュメントへの導線と UI テストメモを整理。（#69 で実施済み）
3. ✅ `data/questions.v1.json` を投入し、#31/#30 にステータスメモを追記。
4. ✅ `Question` 型と JSON Schema/フィクスチャの整合を取るタスクを実施し、#65 のランタイム型ガード導入準備を整える。（型整合 PR #70 済み）
5. ✅ CI（#36）とアクセシビリティ監査（#64）を順に着手。→ #36 完了（Quality Gates導入済み / PR #71）、#64 監査結果を `docs/quality/a11y-play-result.md` に記録済み（改善候補はIssue #39に追記）。
6. ✅ Issue メンテナンス（#34/#11 クローズ、#37 などの優先度変更）を適宜実施済み。

## 次のアクション候補（2025-09-28 更新）

1. ⏳ #74 **FE: Enhance accessibility semantics for timer and result summary** — タイマーの `aria-live` や結果サマリのセマンティクス改善。
2. ⏳ #77 **FE: Add contract tests for metrics and reveal payloads** — ランタイム型ガードに加え、payload のユニットテストを整備。
3. ⏳ #75 **Ops: Instrument web vitals and custom performance marks** — Web Vitals 取得とパフォーマンスマーク設置、ドキュメント更新。
4. ⏳ #76 **CI: Add Lighthouse smoke to catch performance regressions** — Lighthouse CI を導入し、PR ごとのスコアを監視。

---

> 更新日: 2025-09-28 / 担当: Codex 作業メモ

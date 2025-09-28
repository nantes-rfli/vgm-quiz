# Frontend Testing Notes

- Status: Draft
- Last Updated: 2025-09-28

## この文書の目的
フロントエンド開発者が、実装変更時にどのテストを実行し、どの観点を確認すべきかを素早く把握するためのメモです。`docs/quality/e2e-plan.md` で定義している公式な E2E 運用と補完関係にあり、より実務的な注意点や手動検証手順をまとめます。

## 適用範囲
- `web/` 配下の Next.js アプリに関する UI／UX 検証
- Playwright テストのローカル実行・デバッグ
- 手動チェック（アクセシビリティ、視覚確認、メトリクス）

---

## 1. テストレイヤー概要

| レイヤー | 目的 | 代表的な手段 |
| --- | --- | --- |
| 単体 (Component/Hook) | 表示ロジックやフォーマッタの小さな仕様確認 | React Testing Library（未整備、必要時に追加） |
| 統合 (Page/Reducer) | `/play` の状態遷移・Reducer の副作用検証 | Playwright でモックを利用しながら実行 |
| End-to-End | MVP のユーザーストーリー (U1〜U5) を通す | `tests/e2e/play-smoke.spec.ts`, `tests/e2e/play-features.spec.ts` |

> Playwright シナリオの網羅方針は `docs/quality/e2e-plan.md` と `docs/quality/e2e-scenarios.md` を参照してください。本メモでは実装担当者向けに「どのケースを触ったらどのテストを回すべきか」を整理します。

---

## 2. 変更タイプ別チェックリスト

### 2.1 `/play` 周辺の挙動を変更した場合
- [ ] `npm run dev` でローカル起動し、自動スタートが意図通り動くか確認。
- [ ] キーボード操作（数字/矢印/Enter）が想定通りか、フォーカス移動を目視確認。
- [ ] Reveal フェーズでリンク/埋め込みが切り替わるか、Playwright `play-features` シナリオで確認。
- [ ] `recordMetricsEvent` の呼び出しが期待通りか `Application > Local Storage` で `vgm2.metrics.queue` を確認。

### 2.2 結果画面や保存まわりを変更した場合
- [ ] `/result` で履歴カードがすべて描画されるか手動で確認。
- [ ] `sessionStorage` に保存される結果 (`vgm2.result.summary`) の構造を DevTools で確認。
- [ ] `npm run test:e2e -- tests/e2e/play-smoke.spec.ts` を実行。

### 2.3 ドキュメント・設定のみ変更した場合
- [ ] Lint/Typecheck が影響する場合は `npm run lint`, `npm run typecheck` を実行。
- [ ] `.md` 変更のみであっても関連 Issue / Runbook の整合を確認。

---

## 3. Playwright 実行メモ

| コマンド | 用途 |
| --- | --- |
| `npm run test:e2e` | Chromium で全シナリオ実行。CI と同じ挙動。 |
| `npm run test:e2e -- --project=chromium --headed` | UI 表示を見ながらデバッグ。 |
| `npm run test:e2e -- --grep @smoke` | タグ付きシナリオのみ実行（タグ追加時に利用）。 |
| `npx playwright show-report` | 直近のレポートをブラウザで確認。 |

- MSW がデフォルトで有効なのでモックレスポンスは `web/mocks/fixtures/` を修正します。
- 実 BE と接続したい場合は `.env.local` で `NEXT_PUBLIC_API_MOCK=0` を設定し、Playwright 側で `storageState` を切り替える必要があります（今後の拡張）。
- テスト中にメトリクス API を強制的にエラーへしたい場合は `page.route('/v1/metrics', ...)` を利用する実装例が `play-features.spec.ts` にあります。

---

## 4. 手動検証のポイント

| 観点 | 手順 | 補足 |
| --- | --- | --- |
| フォーカス管理 | `Tab` で移動し、アクティブ要素のアウトラインと Enter 操作を確認 | 期待動作は #64 で整理予定 |
| レスポンシブ | DevTools のデバイスモードで iPhone SE 幅（375px）を確認 | 主要な breakpoints だけでも確認 |
| 埋め込みフォールバック | Inline ON で YouTube 埋め込みが表示 → 手動で `about:blank` に差し替えエラー時の挙動を見る | エラー時 `embed_error` が記録されるかイベントログを確認 |
| ローカルストレージ | `vgm2.inlinePlayback.enabled` など設定値が保存されているかを見る | リセットしたい場合はキーを削除 |

---

## 5. ドキュメント更新の流れ

1. 変更対象に関連する仕様ドキュメントを確認（例: `docs/frontend/play-flow.md`, `docs/product/embed-policy.md`）。
2. 振る舞いを変更した場合は該当ドキュメントも同じ PR で更新。
3. テスト観点に差分が生じる場合、本メモまたは `docs/quality/e2e-scenarios.md` に追記。
4. Issue 側にもテスト証跡（実行コマンド・結果）を添付すると再現性が高まる。

---

## 参考リンク

- `docs/quality/e2e-plan.md` — E2E テストの公式運用手順
- `docs/quality/e2e-scenarios.md` — シナリオ一覧と網羅状況
- `docs/frontend/play-flow.md` — `/play` の状態遷移と副作用
- `docs/frontend/metrics-client.md` — メトリクス送信の仕組み
- `docs/product/embed-policy.md` — 埋め込み/リンクのガイドライン

> 更新の際は最終更新日 (`Last Updated`) を忘れずに書き換えてください。

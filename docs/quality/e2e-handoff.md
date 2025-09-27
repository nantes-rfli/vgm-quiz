# E2E Handoff Notes

- Status: Draft
- Last Updated: 2025-09-27

## 1. 現状まとめ
- Playwright を導入済み (`@playwright/test`、`playwright.config.ts`、`npm run test:e2e`).
- Smoke シナリオ (`tests/e2e/play-smoke.spec.ts`) を作成し、MSW のフィクスチャ回答で `/play` → `/result` を完走確認。
- テストはローカル環境で成功済み。サンドボックスではポート制限により実行不可。
- 品質ドキュメント (`docs/quality/`) を整備済み。
- 作業ブランチ: `feature/e2e-playwright`（PR 未作成）。

## 2. 進め方（推奨ワークフロー）
1. **PR 作成・レビュー** — `feature/e2e-playwright` を main へマージしてベースラインを整える。
2. **CI 組み込み** — GitHub Actions 等で `npm ci` → `npx playwright install --with-deps` → `npm run test:e2e` を実行。失敗時はレポートをアーティファクト保存。
3. **シナリオ拡張** — 下記 4章の優先順位に沿ってテストケースを追加。
4. **実行環境整備** — Nightly やタグ付き実行など、負荷の高いシナリオ（耐久・ネットワーク系）は別ジョブ化を検討。
5. **ドキュメント更新** — 新規シナリオ追加時は `docs/quality/e2e-scenarios.md` を随時更新する。

## 3. 実行手順
```bash
cd web
npm install
npm run test:e2e      # dev サーバを自動起動して Playwright 実行
npm run test:e2e:ui   # UI モードでデバッグ
```

## 4. シナリオ案と優先度（抜粋）

| ランク | シナリオ | 目的 / 内容 | 次のアクション |
| --- | --- | --- | --- |
| A (スモーク) | `/play` → `/result` 完走 | 真っ先に main を守る基本フロー。既に `play-smoke.spec.ts` で実装済み。 | CI に組み込み。テストデータをフィクスチャから取得する形で継続。 |
| B (バランス) | 正誤混在、Reveal リンク、設定トグル | ユーザー体験に近い機能カバレッジ。各ケースで `data-testid` を追加しやすい。 | `play-features.spec.ts` でトグル保持・Reveal リンク属性・タイムアウト記録・リンク欠落フォールバック・主要メトリクス送信を実装済み。 |
| C (耐久 / ネットワーク) | `/v1/metrics` 失敗→再送、オフライン→復帰 | 異常系検証。Playwright の `route` モックや `context.setOffline` を活用する。 | リリース前チェックや夜間ジョブとして別 pipeline に分離。 |

詳細は `docs/quality/e2e-scenarios.md` を参照。各シナリオに必要なテストデータや実装メモを記載済み。

## 5. TODO / 次のステップ
1. `feature/e2e-playwright` で PR 作成 → main へマージ。
2. CI パイプラインへのスモークテスト導入 — `.github/workflows/e2e-smoke.yml` で Playwright を実行（push/pr と手動トリガー対応）。
3. シナリオB の残タスク（例: 異常系リンクのさらなるバリエーション、メトリクス異常系の検証など）を追加実装。
4. Next.js DevTools 警告への対応（今後の Next.js メジャーで `allowedDevOrigins` を設定）。

## 6. 補足
- Reveal の Next ボタン・選択肢には `data-testid` を付与済み。
- Metrics API への送信は現状テスト対象外。必要であれば `page.on('request')` で検証可能。
- Playwright 実行時に Next.js DevTools ボタンが表示されるため `data-testid` 経由で操作している。DevTools 自体を無効にする場合は `NEXT_DISABLE_DEVTOOLS=1` を設定。
```

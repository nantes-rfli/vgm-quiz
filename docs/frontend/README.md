# Frontend Overview

- Status: Draft
- Last Updated: 2025-10-04

## この文書の目的
フロントエンド層の全体像と、詳細ドキュメントの索引をまとめる。実装に合わせた技術選定・構成・運用上のルールを 1 ページで把握できるようにする。

---

## 1. 技術スタック
- **Framework**: Next.js App Router (14+) / React 19 / TypeScript 5
- **Styling**: Tailwind CSS v4 + shadcn/ui ベースのユーティリティ
- **Theming**: `next-themes` による Light/Dark/Auto モード切り替え（詳細: [`theme-system.md`](./theme-system.md)）
- **i18n**: 日本語・英語対応（ブラウザ言語自動検出、詳細: [`i18n-guide.md`](./i18n-guide.md)）
- **State & Data**: `useReducer` を中心にコンポーネント局所で管理。ラウンド状態は `app/play/page.tsx` に集約。
- **API 通信**: フロントからは `/v1/rounds/*` と `/v1/metrics` の2系統のみを呼び出す。MVP では Mock Service Worker (MSW) が応答。
- **Storage**:
  - `sessionStorage`: プレイ結果（`vgm2.result.summary`）、リビール履歴（`vgm2.result.reveals`）
  - `localStorage`: テーマ設定（`vgm2.settings.theme`）、言語設定（`vgm2.settings.locale`）、インライン再生（`vgm2.settings.inlinePlayback`）、メトリクスキュー（`vgm2.metrics.queue`）、匿名クライアントID（`vgm2.metrics.clientId`）

---

## 2. 主要ドキュメント
| ページ | 内容 | 備考 |
| --- | --- | --- |
| [`play-flow.md`](./play-flow.md) | `/play` の状態遷移・タイマー・結果保存・Result 画面との連携 | FE-06 実装内容の整理 |
| [`metrics-client.md`](./metrics-client.md) | メトリクスのバッチ送信、イベント語彙、リトライ方針 | FE-07 実装内容の整理 |
| [`theme-system.md`](./theme-system.md) | テーマシステム（Light/Dark/Auto）の実装と使い方 | Phase 1 |
| [`i18n-guide.md`](./i18n-guide.md) | 多言語対応（日本語・英語）の実装ガイド | Phase 2 |
| [`testing-notes.md`](./testing-notes.md) | フロントエンド開発者向けのテスト実施メモとローカル検証の注意点 | Draft |

> **ルール**: 1トピック=1ページを維持し、詳細は各ドキュメントへ分割する。構成変更時は本 README の表を更新する。

---

## 3. 開発・運用時のガイド
- MSW によるモックがデフォルト。`NEXT_PUBLIC_API_MOCK=0` にすると実サーバを叩く前提の配線になる（BE 実装時に合わせて見直す）。
- 共有コンポーネントは `web/src/components/` に配置し、Atomic ではなく画面単位での再利用を優先。
- ドキュメント更新とコード変更は同じ PR で行う（Docs-as-Code）。

---

## 4. 実装済み機能（Phase 1-4）
- ✅ テーマシステム（Light/Dark/Auto、Phase 1）
- ✅ 多言語対応（日本語・英語、Phase 2）
- ✅ アクセシビリティ強化（ARIA属性、Phase 3）
- ✅ 設定画面（`/settings`、Phase 4）
- ✅ メタデータ最適化（OGP、Twitter Card、Phase 4）
- ✅ E2E テスト基盤（Playwright + axe-core）

## 5. 今後の TODO
- SSR/SEO 要件の整理（MVP では CSR 前提）
- 実 BE 接続時のエラー UX / オフライン時挙動の仕様化
- ゲームメタデータの多言語対応（API側の対応が必要）

# Frontend Overview

- Status: Draft
- Last Updated: 2025-09-27

## この文書の目的
フロントエンド層の全体像と、詳細ドキュメントの索引をまとめる。実装に合わせた技術選定・構成・運用上のルールを 1 ページで把握できるようにする。

---

## 1. 技術スタック
- **Framework**: Next.js App Router (14+) / React 19 / TypeScript 5
- **Styling**: Tailwind CSS v4 + shadcn/ui ベースのユーティリティ
- **State & Data**: `useReducer` を中心にコンポーネント局所で管理。ラウンド状態は `app/play/page.tsx` に集約。
- **API 通信**: フロントからは `/v1/rounds/*` と `/v1/metrics` の2系統のみを呼び出す。MVP では Mock Service Worker (MSW) が応答。
- **Storage**: `sessionStorage` でプレイ結果／リビール履歴、`localStorage` でインライン再生設定・メトリクスキュー・匿名 `client_id` を保持。

---

## 2. 主要ドキュメント
| ページ | 内容 | 備考 |
| --- | --- | --- |
| [`play-flow.md`](./play-flow.md) | `/play` の状態遷移・タイマー・結果保存・Result 画面との連携 | FE-06 実装内容の整理 |
| [`metrics-client.md`](./metrics-client.md) | メトリクスのバッチ送信、イベント語彙、リトライ方針 | FE-07 実装内容の整理 |
| [`testing-notes.md`](./testing-notes.md) | （未作成）E2E や UI テスト方針の予定地 | 需要が出た際に追加 |

> **ルール**: 1トピック=1ページを維持し、詳細は各ドキュメントへ分割する。構成変更時は本 README の表を更新する。

---

## 3. 開発・運用時のガイド
- MSW によるモックがデフォルト。`NEXT_PUBLIC_API_MOCK=0` にすると実サーバを叩く前提の配線になる（BE 実装時に合わせて見直す）。
- 共有コンポーネントは `web/src/components/` に配置し、Atomic ではなく画面単位での再利用を優先。
- ドキュメント更新とコード変更は同じ PR で行う（Docs-as-Code）。

---

## 4. 今後の TODO
- SSR/SEO 要件の整理（MVP では CSR 前提）
- E2E テスト基盤の決定（Playwright/Cypress 等）
- 実 BE 接続時のエラー UX / オフライン時挙動の仕様化


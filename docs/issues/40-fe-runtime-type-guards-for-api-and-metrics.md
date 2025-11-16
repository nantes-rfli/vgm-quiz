---
id: 40
issue: 65
slug: fe-runtime-type-guards-for-api-and-metrics
title: "FE: Runtime type guards for API responses and metrics payloads"
labels: ["type:task", "area:fe", "phase:3", "priority:P1", "key:FE-TYPE-GUARD"]
status: "in-progress"
updated: 2025-11-15
owner: "frontend"
links:
  roadmap: ../dev/roadmap.md#phase-3---observability--guardrails
  github: https://github.com/nantes-rfli/vgm-quiz/issues/65
---

## 概要
Phase 3 (Observability & Guardrails) のガードレール強化タスク。フロントエンドが `/v1/manifest`, `/v1/rounds/start`, `/v1/rounds/next` のレスポンスをランタイム検証し、メトリクス送信ペイロードも契約違反を検知できるようにする。MVP 時点では型アサーションに頼っていたが、Phase 3 では JWS 化したバックエンドとの契約破りを早期検出する必要がある。

## 2025-11-15 実施内容
- `zod@3` を依存追加し、Manifest/Phase1レスポンス/メトリクスペイロード用スキーマを新設。
- `web/src/features/quiz/datasource.ts` の `fetchJson` にスキーマ検証を組み込み、Zod 失敗時は `ApiError('decode')` を投げるよう統一。
- `web/src/features/quiz/api/manifest.ts` で Manifest キャッシュ読み込み時にも検証を入れ、破損キャッシュを自動破棄。
- メトリクスクライアントで `PendingEvent`/バッチの検証、attr のシリアライズ正規化、破損キューの自動廃棄を実装。
- `tests/unit/apiSchemas.spec.ts` を追加し、Zod スキーマの happy / unhappy path をカバー。
- 既存の metrics contract test を拡張し、未定義 attr 除去＆破損イベント除外の挙動を検証。
- `npm run test:unit` 実行済み（Vitest 45 tests）。

## 未完了タスク / フォローアップ
1. #77 (FE Contract tests for metrics/reveal payloads) で Phase 3B の自動テスト統合を継続。
2. エラー監視: `ApiError('decode')` 発生を Sentry / ログメトリクスで可視化（Observability サブフェーズと連携）。
3. Manifest schema が増えた場合は `docs/api/api-spec.md` とスキーマの同期を忘れない。

## メモ
- Node 25 系では `console.warn(ZodError)` がクラッシュするため、`logMetricsWarning` では `error.message` のみを出力し安全側に倒している。
- `localStorage` を多用するテストのため、Vitest setup で in-memory storage polyfill を整備済み。

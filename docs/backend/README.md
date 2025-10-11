# Backend Overview – vgm-quiz

- **Status**: Draft
- **Owner**: nanto
- **Last Updated**: 2025-10-10

## Purpose

vgm-quiz のバックエンドを Cloudflare Workers + D1 + R2 でシンプルに構築する。データ収集から作問まで完全自動化を目指し、Phase 1 (MVP) では手動キュレーション、Phase 2 以降で段階的に自動化する。

## Scope

### Infrastructure
- **Cloudflare Workers**: API Worker + Pipeline Worker (Cron 実行)
- **D1**: メインデータベース (楽曲メタデータ、audit logs)
- **R2**: 静的アセット (日次 JSON export、将来的に音源ファイル)
- **使用しない**: KV, Durable Objects (シンプル化のため D1 で代替)

### Pipeline (6 stages)
```
Discovery → Harvest → Guard → Dedup → Score → Publish
```

各ステージは単一責任の原則に従い、独立してテスト・改善可能。

### Data Flow
1. **Discovery**: 外部ソースから楽曲 ID リスト取得
2. **Harvest**: メタデータ・音源取得、正規化
3. **Guard**: 品質・ポリシー検証
4. **Dedup**: 重複検出・クラスタリング
5. **Score**: 難易度・周知度算出
6. **Publish**: Pool 管理 + 日次選定 + JSON Export

### API Endpoints
- `GET /daily?date=YYYY-MM-DD` - 日次問題セット取得 (R2 → D1 fallback)
- `GET /v1/rounds/start` - ラウンド開始 (既存 MSW と互換)
- `POST /v1/rounds/next` - 次問題取得 (既存 MSW と互換)

## Key Decisions (ADR)

### ADR-001: Queue-less Architecture
**決定**: Cloudflare Queues を使わず、Workers Cron + 直列実行を採用

**理由**:
- MVP フェーズでは処理量が少ない (1日1回の Export で十分)
- Cron で十分なスループット (30分おきの Discovery/Harvest)
- 将来的に Queues へ移行可能な設計を維持

### ADR-002: Single Source of Truth - R2 Export
**決定**: Export した R2 JSON を唯一の配信ソースとする

**理由**:
- D1 から都度生成するとレイテンシ増加
- R2 は CDN 統合でグローバル配信に最適
- バージョン管理・ロールバックが容易

### ADR-003: Biome for Linting/Formatting
**決定**: ESLint + Prettier でなく Biome を採用

**理由**:
- フロントエンドと統一 (将来的に web/ も移行)
- 高速・オールインワン
- Workers 特有の型定義に対応

### ADR-004: Phase-based Automation
**決定**: Phase 1 は手動キュレーション、Phase 2 で Spotify API 自動化

| Phase | Discovery | Harvest | Guard | Score |
|-------|-----------|---------|-------|-------|
| **1 (MVP)** | 手動 JSON | - | 手動検証 | Static (メタデータ) |
| **2** | Spotify API | Spotify API | ルールベース | + Acoustic |
| **3** | + YouTube | + 音源 DL | + ML 品質 | + Behavioral |

## Core Principles

### Functional Design
各ステージは**純粋関数的**に設計:
- **決定性**: 同じ入力 → 同じ出力
- **冪等性**: 複数回実行しても結果不変
- **副作用の隔離**: DB 書き込みは最後のコミットフェーズのみ

### Envelope Schema
全ステージの入出力を統一:

```typescript
{
  "meta": {
    "stage": "guard",
    "version": "1.0.0",
    "as_of": "2025-10-10T00:00:00Z",
    "input_hash": "sha256:...",
    "refdata": { "alias_graph": "v2025.10.01" }
  },
  "payload": {
    "status": "ok" | "partial" | "failed",
    "output": { /* stage-specific */ },
    "warnings": []
  }
}
```

### Audit Trail
- すべての実行を `audits` テーブルに記録
- 失敗時は `audits.ok=false` + `reasons` を保存
- 次回 Cron で未完ステージから再開

## Non-Functional Requirements

- **Availability**: 前日 23:00 JST までに翌日分 Export 完了
- **Idempotency**: `stage + version + hash(input)` で重複実行を無害化
- **Traceability**: `audits` で入出力 hash と系譜を追跡
- **Security**: R2 署名付き URL、Secrets は `wrangler secret` で管理

## Documentation Structure

```
docs/backend/
├── README.md              # このファイル
├── architecture.md        # Workers 構成・データフロー図
├── database.md            # DDL・ER 図
├── pipeline/
│   ├── 00-overview.md
│   ├── 01-discovery.md
│   ├── 02-harvest.md
│   ├── 03-guard.md
│   ├── 04-dedup.md
│   ├── 05-score.md
│   └── 06-publish.md
├── api.md                 # API 仕様
├── scheduler.md           # Cron 設定
├── operations.md          # デプロイ・監視
├── setup.md               # 開発環境構築
└── testing.md             # テスト戦略
```

## Quick Start

詳細は [setup.md](setup.md) を参照。

```bash
cd workers
npm install
npm run dev          # ローカル開発サーバー起動
npm run typecheck    # 型チェック
npm run test         # Vitest + Miniflare
```

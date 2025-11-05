# Backend Architecture – vgm-quiz

- **Status**: Draft
- **Last Updated**: 2025-10-10

## System Architecture

### Workers Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Worker: pipeline]  ← Cron Triggers                         │
│    ├─ Discovery  → D1 (discovery_items)                      │
│    ├─ Harvest    → D1 (tracks_normalized) + R2 (raw_blobs)   │
│    ├─ Guard      → D1 (tracks_normalized.guard_status)       │
│    ├─ Dedup      → D1 (clusters)                             │
│    ├─ Score      → D1 (scores)                               │
│    └─ Publish    → D1 (pool, picks, exports) + R2 (JSON)     │
│                                                               │
│  [Worker: api]                                               │
│    ├─ GET /daily?date=YYYY-MM-DD → R2 (fallback: D1)         │
│    ├─ POST /v1/rounds/start      → D1/R2 (問題セット取得)    │
│    └─ POST /v1/rounds/next       → D1/R2 (次問題取得)        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
  ┌──────────┐                           ┌──────────┐
  │ D1 (SQL) │                           │ R2 (S3)  │
  ├──────────┤                           ├──────────┤
  │ sources  │                           │ /exports/│
  │ tracks_* │                           │ /blobs/  │
  │ clusters │                           │          │
  │ scores   │                           └──────────┘
  │ pool     │
  │ picks    │
  │ audits   │
  └──────────┘
```

### Data Flow

#### Pipeline Flow (Cron-triggered)

```
┌─────────────┐
│ External    │  (Phase 2: Spotify/YouTube API)
│ Data Source │  (Phase 1: curated.json)
└──────┬──────┘
       │
       ↓
┌─────────────┐  input: source config
│ Discovery   │  output: discovery_items[]
└──────┬──────┘         (external_id, url, priority)
       │
       ↓
┌─────────────┐  input: discovery_items
│ Harvest     │  output: tracks_normalized[], raw_blobs[]
└──────┬──────┘         (title, game, composer, etc.)
       │
       ↓
┌─────────────┐  input: tracks_normalized
│ Guard       │  output: tracks_normalized (guard_status updated)
└──────┬──────┘         (approved/rejected/pending)
       │
       ↓
┌─────────────┐  input: tracks (guard_status=approved)
│ Dedup       │  output: clusters[]
└──────┬──────┘         (canonical_track_id, variant_ids)
       │
       ↓
┌─────────────┐  input: clusters, tracks
│ Score       │  output: scores[] (difficulty, notability, quality)
└──────┬──────┘         (0-100 scale)
       │
       ↓
┌─────────────┐  input: scores, pool state
│ Publish     │  output: picks[], exports[], R2 JSON
└──────┬──────┘         (daily question set)
       │
       ↓
  ┌─────────┐
  │ R2      │  /exports/2025-10-10.json
  │ Export  │  { questions: [...], meta: {...} }
  └─────────┘
```

#### API Request Flow

```
[Client]
   │
   │ GET /daily?date=2025-10-10
   ↓
[Worker: api]
   │
   ├─ Check R2: /exports/2025-10-10.json
   │  ├─ Found → Return JSON (Cache-Control: public, max-age=3600)
   │  └─ Not Found ↓
   │
   └─ Fallback: Query D1 (picks table)
      └─ Generate JSON on-the-fly → Return (no cache)
```

### Deployment Architecture

```
GitHub Repository (vgm-quiz)
   │
   │ git push
   ↓
GitHub Actions
   │
   ├─ workers/pipeline: wrangler deploy
   │  └─ Upload to Cloudflare Workers
   │
   └─ workers/api: wrangler deploy
      └─ Upload to Cloudflare Workers

Cloudflare Dashboard
   │
   ├─ Cron Triggers
   │  ├─ Discovery/Harvest: */30 * * * * (every 30min)
   │  └─ Publish: 0 15 * * * (daily 15:00 UTC = 00:00 JST)
   │
   ├─ D1 Database
   │  └─ Migrations: wrangler d1 migrations apply
   │
   └─ R2 Bucket
      ├─ /exports/ (daily JSON)
      └─ /blobs/ (raw audio, Phase 2+)
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Cloudflare Workers | Serverless compute |
| **Language** | TypeScript 5 | Type safety |
| **Linter** | Biome | Fast linting/formatting |
| **Database** | D1 (SQLite) | Relational data |
| **Storage** | R2 (S3-compatible) | Static assets |
| **Scheduler** | Cron Triggers | Periodic jobs |
| **Testing** | Vitest + Miniflare | Unit + Integration |
| **CI/CD** | GitHub Actions | Automated deployment |

## Cloudflare Free Tier Limits

| Service | Limit | Usage Estimate |
|---------|-------|----------------|
| **Workers** | 100,000 req/day | ~3,000/day (API) + ~10/day (Cron) |
| **D1** | 5GB storage, 25B reads/mo | ~100MB (10k tracks) |
| **R2** | 10GB storage, 1M reads/mo | ~100MB (365 exports) |
| **Cron** | Unlimited | 48 jobs/day (Discovery) + 1 job/day (Publish) |

**結論**: 無料枠で十分運用可能

## Module Layout（実装準備）

| Directory | Role | Notes |
|-----------|------|-------|
| `workers/` | Cloudflare Workers monorepo | `package.json` でパイプライン/API 共通依存を管理 |
| `workers/pipeline/src/stages/` | 各ステージ実装 (`discovery.ts` など) | 単一責任を保ち、`StageContext` を介して D1/R2 にアクセス |
| `workers/pipeline/src/lib/` | 共有ユーティリティ（`hash.ts`, `shuffle.ts`, `choices.ts` など） | `generateChoices`、`Envelope` 型、`selectWithDiversity` をここに配置 |
| `workers/pipeline/src/config/` | 設定値 (`cron.ts`, `limits.ts`) | 環境変数のデフォルト値を集中管理 |
| `workers/api/src/routes/` | API エンドポイント | 既存エクスポート JSON を返却する HTTP ルート |
| `workers/shared/types/` | 共通型 (`Track`, `Score`, `Envelope`) | パイプラインと API が同一型を共有し、重複定義を防止 |

- 共通モジュールは `workers/shared/` で `tsconfig.paths` を利用して import（例: `@shared/types`）。
- `generateChoices` や `shuffle` など Publish で利用するロジックは `workers/pipeline/src/lib/choices.ts` に切り出し、将来的に API 側で使い回せるようにする。
- Biome 設定は `workers/biome.json` を用意し、`npm run lint` で pipeline/API 双方を検査する。

## Non-Functional Requirements

### Availability
- **Target**: 前日 23:00 JST までに翌日分 Export 完了
- **SLA**: 99% (月1回の失敗まで許容)
- **Recovery**: Cron 再実行で自動復旧

### Performance
- **API Latency**: p95 < 500ms (R2 cache hit 時)
- **Pipeline Duration**: 全ステージ < 10分 (Phase 1)

### Scalability
- **Phase 1**: 100曲/日 (手動キュレーション)
- **Phase 2**: 1,000曲/日 (Spotify API)
- **Phase 3**: 10,000曲/日 (複数ソース並列)

### Security
- **Secrets**: `wrangler secret` で環境変数管理
- **API Keys**: 最小権限 (read-only for external APIs)
- **R2 Access**: 署名付き URL (有効期限1時間)

### Observability
- **Logs**: Cloudflare Workers Logs (tail: `wrangler tail`)
- **Metrics**: `audits` テーブルで実行履歴追跡
- **Alerts**: (Phase 2) 失敗時に Slack 通知

## Error Handling Strategy

### Retry Policy
- **Transient errors** (network timeout): 指数バックオフで3回リトライ
- **Non-transient errors** (invalid data): `audits.ok=false` 記録、スキップ
- **Partial success**: `status=partial` で次ステージ続行

### Idempotency
- **Key**: `hash(stage + version + input)`
- **Check**: `audits` テーブルで重複検出
- **Skip**: 同一 hash の成功記録があればスキップ

### Graceful Degradation
- **R2 障害時**: API が D1 から直接生成 (キャッシュなし)
- **D1 障害時**: 前日の Export を再利用
- **Pipeline 障害時**: 次回 Cron で未完ステージから再開

## Migration Path

### Phase 1 → Phase 2
- Discovery: `curated.json` → Spotify API
- Harvest: 手動メタデータ → API 自動取得
- Guard: 手動検証 → ルールベース自動検証

### Future Enhancements (Phase 3+)
- **Queues**: Cron → Cloudflare Queues (高スループット化)
- **Durable Objects**: ステートフル処理 (リアルタイム更新)
- **KV**: エイリアス辞書キャッシュ (Dedup 高速化)
- **Workers Analytics Engine**: メトリクス集計

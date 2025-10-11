# Pipeline Overview – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Pipeline Architecture (6 Stages)

```
External Source → Discovery → Harvest → Guard → Dedup → Score → Publish → R2 Export
                     ↓           ↓         ↓       ↓       ↓        ↓
                    D1          D1        D1      D1      D1    D1 + R2
```

各ステージは**単一責任の原則**に従い、独立してテスト・改善可能。

## Stage Descriptions

### 1. Discovery
- **Purpose**: 外部ソースから楽曲 ID/URL リストを取得
- **Input**: Source config (API credentials, endpoint URLs)
- **Output**: `discovery_items[]` (external_id, url, priority)
- **Storage**: D1 (`discovery_items` table)
- **Phase 1**: 手動 JSON (`curated.json`)
- **Phase 2**: Spotify API, YouTube API

### 2. Harvest
- **Purpose**: メタデータ・音源を取得し、正規化
- **Input**: `discovery_items[]`
- **Output**: `tracks_normalized[]`, `raw_blobs[]`
- **Storage**: D1 (`tracks_normalized` table) + R2 (`/blobs/`)
- **Phase 1**: JSON から直接読み込み (音源なし)
- **Phase 2**: API からメタデータ取得、音源 URL 保存
- **Phase 3**: 音源ファイルを R2 にダウンロード

### 3. Guard
- **Purpose**: 品質・ポリシー検証
- **Input**: `tracks_normalized[]`
- **Output**: `tracks_normalized.guard_status` (approved/rejected/pending)
- **Storage**: D1 (update `guard_status` column)
- **Phase 1**: 手動検証済み (全て approved)
- **Phase 2**: ルールベース (必須フィールド、ブラックリストワード)
- **Phase 3**: ML 品質判定 (音質、ノイズ検出)

### 4. Dedup
- **Purpose**: 重複検出・クラスタリング
- **Input**: `tracks_normalized[]` (guard_status = approved)
- **Output**: `clusters[]` (canonical_track_id, variant_ids)
- **Storage**: D1 (`clusters` table)
- **Phase 1**: 手動キュレーションで重複なし (スキップ可)
- **Phase 2**: タイトル正規化 + Levenshtein 距離
- **Phase 3**: 音響指紋 (Chromaprint) で完全一致検出

### 5. Score
- **Purpose**: 難易度・周知度・品質スコア算出
- **Input**: `clusters[]`, `tracks_normalized[]`
- **Output**: `scores[]` (difficulty, notability, quality)
- **Storage**: D1 (`scores` table)
- **Phase 1**: Static (メタデータベース: year, series popularity)
- **Phase 2**: + Acoustic (BPM, テンポ変化, イントロ長)
- **Phase 3**: + Behavioral (ユーザー正答率フィードバック)

### 6. Publish
- **Purpose**: Pool 管理 + 日次選定 + JSON Export
- **Input**: `scores[]`, `pool` state
- **Output**: `picks[]`, `exports[]`, R2 JSON
- **Storage**: D1 (`pool`, `picks`, `exports`) + R2 (`/exports/YYYY-MM-DD.json`)
- **Process**:
  1. Pool から cooldown 期間外の楽曲を選定
  2. 多様性制約 (series, composer, platform, difficulty 分散)
  3. 10曲選定 + 各4選択肢生成 (3誤答)
  4. R2 に JSON export + D1 に pick 記録

## Envelope Schema

全ステージの入出力を統一フォーマットで管理:

```typescript
interface Envelope<T> {
  meta: {
    stage: string           // "discovery" | "harvest" | ...
    version: string         // Semantic version (e.g., "1.2.0")
    as_of: string           // ISO 8601 timestamp
    input_hash: string      // SHA-256 hash of input
    refdata?: {             // Optional reference data versions
      alias_graph?: string  // (for Dedup)
      difficulty_model?: string  // (for Score)
    }
  }
  payload: {
    status: 'ok' | 'partial' | 'failed'
    output: T               // Stage-specific output type
    warnings?: string[]     // Non-fatal issues
  }
}
```

### Example: Discovery Output

```json
{
  "meta": {
    "stage": "discovery",
    "version": "1.0.0",
    "as_of": "2025-10-10T00:00:00Z",
    "input_hash": "sha256:abc123..."
  },
  "payload": {
    "status": "ok",
    "output": {
      "items_discovered": 50,
      "items": [
        {
          "external_id": "spotify:track:xyz",
          "url": "https://api.spotify.com/v1/tracks/xyz",
          "priority": 1
        }
      ]
    }
  }
}
```

## Cron Schedule

| Stage | Frequency | Cron Expression | UTC Time | JST Time |
|-------|-----------|-----------------|----------|----------|
| **Discovery** | Every 30min | `*/30 * * * *` | 00:00, 00:30, ... | 09:00, 09:30, ... |
| **Harvest** | Every 30min (offset +5m) | `5,35 * * * *` | 00:05, 00:35, ... | 09:05, 09:35, ... |
| **Publish** | Daily | `0 15 * * *` | 15:00 | 00:00 (next day) |

**Guard/Dedup/Score** は Publish の直前に連鎖実行:

```
15:00 UTC (00:00 JST):
 Guard → Dedup → Score → Publish
```

Discovery と Harvest の間に 5 分のオフセットを設け、Discovery が `discovery_items` へのコミットと `audits` 更新を終えてから Harvest が同じ入力ハッシュで処理を開始する。ジョブはオフセット込みで冪等チェック (`audits` テーブル) を共有し、必要に応じて Harvest は次のサイクルまで待機できるようにする。

## Execution Flow

### Normal Flow (Success)

```
┌─────────────┐
│ Cron Trigger│
└──────┬──────┘
       │
       ↓
┌─────────────┐  1. Check audits for previous success
│ Stage Entry │     (same input_hash)
└──────┬──────┘
       │ No → Proceed
       │ Yes → Skip (idempotent)
       ↓
┌─────────────┐  2. Compute input_hash
│ Process     │  3. Execute stage logic
└──────┬──────┘  4. Compute output_hash
       │
       ↓
┌─────────────┐  5. Write to D1/R2
│ Commit      │  6. Record audit (ok=true)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Next Stage  │
└─────────────┘
```

### Error Flow

```
┌─────────────┐
│ Stage Entry │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Process     │ → Error (e.g., API timeout)
└──────┬──────┘
       │
       ↓
┌─────────────┐  1. Rollback transaction
│ Error Handle│  2. Record audit (ok=false, reasons=[...])
└──────┬──────┘  3. Log error details
       │
       ↓
┌─────────────┐
│ Early Exit  │ (Skip remaining stages)
└──────┬──────┘
       │
       ↓
┌─────────────┐  Next Cron run:
│ Retry Later │  - Check audits
└─────────────┘  - Resume from failed stage
```

## Audit Trail

すべての実行履歴を `audits` テーブルに記録:

```sql
CREATE TABLE audits (
  job_id TEXT PRIMARY KEY,           -- UUID
  stage TEXT NOT NULL,               -- "discovery" | "harvest" | ...
  input_hash TEXT NOT NULL,          -- SHA-256 of input
  output_hash TEXT,                  -- SHA-256 of output (null if failed)
  ok BOOLEAN NOT NULL,               -- Success/failure
  reasons TEXT[],                    -- Error reasons (if failed)
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP
);

CREATE INDEX idx_audits_stage_hash ON audits(stage, input_hash);
```

### Idempotency Check

```typescript
async function isAlreadyProcessed(db: D1Database, stage: string, inputHash: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT ok FROM audits WHERE stage = ? AND input_hash = ? AND ok = true LIMIT 1')
    .bind(stage, inputHash)
    .first()

  return result !== null
}
```

## Data Dependencies

```
Discovery
   ↓
Harvest (depends on discovery_items)
   ↓
Guard (depends on tracks_normalized)
   ↓
Dedup (depends on tracks with guard_status=approved)
   ↓
Score (depends on clusters)
   ↓
Publish (depends on scores + pool state)
```

各ステージは前段の完了を前提とするが、**直接的な結合は避ける** (DB 経由で疎結合)。

## Phase Roadmap

| Phase | Discovery | Harvest | Guard | Dedup | Score | Publish |
|-------|-----------|---------|-------|-------|-------|---------|
| **1 (MVP)** | Manual JSON | Read JSON | Skip (pre-approved) | Skip (no duplicates) | Static | Core picker |
| **2** | Spotify API | Fetch metadata | Rule-based | Title matching | + Acoustic | + Diversity |
| **3** | + YouTube | + Audio DL | + ML quality | + Fingerprint | + Behavioral | + A/B test |

## Automation Roadmap

最終目標は Discovery から Publish までの完全自動化。Phase 1 ではキュレーターが入力ファイルとレビューを担うが、Phase 2 以降は API 連携・自動検証・音源処理・自動出題までを段階的に機械化する。ステージは単一責任かつ疎結合を維持し、各ステージが成功すれば次ステージが自動的に起動する構造とする（例: Discovery 完了 → Harvest 自動起動）。これにより手動作業は例外時のリカバリーとルール調整に限定される。

## Stage Documentation

詳細は各ステージのドキュメントを参照:

- [01-discovery.md](01-discovery.md)
- [02-harvest.md](02-harvest.md)
- [03-guard.md](03-guard.md)
- [04-dedup.md](04-dedup.md)
- [05-score.md](05-score.md)
- [06-publish.md](06-publish.md)

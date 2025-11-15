# Phase 1 Implementation Plan – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10
- **Target**: MVP (Minimum Viable Product)

## Goal

フロントエンドが動作する最小限のバックエンドを構築。手動キュレーションデータから自動で日次問題セットを生成。

## Scope

### ✅ 実装する機能

1. **Discovery**: `curated.json` から楽曲データを D1 に読み込み
2. **Publish**: 問題選定 + 選択肢自動生成 + R2 Export
3. **API**: `GET /daily` エンドポイント (R2 → D1 fallback)

### ❌ Phase 2 以降に延期

- Guard: 手動データなので品質検証不要
- Dedup: 手動データなので重複なし
- Score: 静的スコアは Publish 内で簡易計算
- Harvest: curated.json がメタデータ完備
- Cron: 手動実行で開始 (Phase 2 で自動化)

## Architecture (Phase 1)

```
curated.json
   ↓
Discovery (manual trigger)
   ↓
D1 (tracks_normalized, pool, picks)
   ↓
Publish (manual trigger)
   ↓
R2 (exports/YYYY-MM-DD.json)
   ↓
API Worker (GET /daily)
   ↓
Frontend
```

## Data Flow

### 1. 初回セットアップ (1回のみ)

```bash
# D1 マイグレーション実行
wrangler d1 migrations apply vgm-quiz-db

# Discovery 実行 (curated.json → D1)
curl -X POST http://localhost:8788/trigger/discovery

# 結果: tracks_normalized に 100 楽曲挿入
```

### 2. 日次 Export 生成 (手動)

```bash
# Publish 実行 (D1 → picks → R2)
curl -X POST http://localhost:8788/trigger/publish?date=2025-10-10

# 結果: R2 に exports/daily/2025-10-10.json 生成
```

### 3. Frontend からの取得

```bash
# GET /daily (R2 から取得)
curl http://localhost:8787/daily?date=2025-10-10

# Response: 10問の問題セット
```

## Database Schema (Phase 1 簡素版)

```sql
-- sources (Discovery 用)
CREATE TABLE sources (
  source_id INTEGER PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'manual',
  enabled BOOLEAN DEFAULT true
);

-- tracks_normalized (楽曲マスタ)
CREATE TABLE tracks_normalized (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  game TEXT NOT NULL,
  series TEXT,
  composer TEXT,
  platform TEXT,
  year INTEGER,
  youtube_url TEXT,
  spotify_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- pool (問題選定用)
CREATE TABLE pool (
  track_id INTEGER PRIMARY KEY,
  state TEXT DEFAULT 'available',
  cooldown_until TIMESTAMP,
  last_picked_at TIMESTAMP,
  times_picked INTEGER DEFAULT 0,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

-- picks (日次選定結果)
CREATE TABLE picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  items TEXT NOT NULL,  -- JSON
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- exports (R2 メタデータ)
CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  r2_key TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`tracks_normalized.external_id` には `curated.json` の `id` を格納し、再取り込み時の UPSERT と外部データの追跡に利用する。

**Phase 2 で追加するテーブル**:
- `discovery_items`, `clusters`, `scores`, `audits`

## Implementation Steps

### Step 1: Project Setup

```bash
# Navigate to project root
cd vgm-quiz

# Create workers directory
mkdir -p workers/{api/src,pipeline/src,shared/{types,lib},migrations,data,tests}

# Initialize npm
cd workers
npm init -y

# Install dev dependencies
npm install -D wrangler @cloudflare/workers-types typescript @biomejs/biome vitest tsx @types/node

# Install runtime dependencies
npm install zod
```

### Step 2: Configuration Files

#### `workers/package.json`

```json
{
  "name": "@vgm-quiz/workers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:api": "wrangler dev --config api/wrangler.toml",
    "dev:pipeline": "wrangler dev --config pipeline/wrangler.toml",
    "deploy:api": "wrangler deploy --config api/wrangler.toml",
    "deploy:pipeline": "wrangler deploy --config pipeline/wrangler.toml",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "test": "vitest run",
    "validate:curated": "tsx scripts/validate-curated.ts"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "@types/node": "^20.11.30",
    "typescript": "^5.7.0",
    "tsx": "^4.11.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.99.0"
  }
}
```

#### `workers/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types", "node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/shared/*": ["./shared/*"]
    }
  },
  "include": ["api/src/**/*", "pipeline/src/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### `workers/biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  }
}
```

#### `workers/api/wrangler.toml`

```toml
name = "vgm-quiz-api"
main = "src/index.ts"
compatibility_date = "2025-10-10"

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = ""  # Fill after creating D1

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vgm-quiz-storage"
```

#### `workers/pipeline/wrangler.toml`

```toml
name = "vgm-quiz-pipeline"
main = "src/index.ts"
compatibility_date = "2025-10-10"

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = ""  # Same as API worker

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vgm-quiz-storage"
```

### Step 3: Database Migration

#### `workers/migrations/0001_initial.sql`

```sql
-- Create sources table
CREATE TABLE sources (
  source_id INTEGER PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'manual',
  enabled BOOLEAN DEFAULT true
);

-- Insert default manual source
INSERT INTO sources (source_id, type, enabled) VALUES (1, 'manual', true);

-- Create tracks_normalized table
CREATE TABLE tracks_normalized (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  game TEXT NOT NULL,
  series TEXT,
  composer TEXT,
  platform TEXT,
  year INTEGER,
  youtube_url TEXT,
  spotify_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create pool table
CREATE TABLE pool (
  track_id INTEGER PRIMARY KEY,
  state TEXT DEFAULT 'available',
  cooldown_until TIMESTAMP,
  last_picked_at TIMESTAMP,
  times_picked INTEGER DEFAULT 0,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX idx_pool_state ON pool(state, cooldown_until);

-- Create picks table
CREATE TABLE picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  items TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_picks_date ON picks(date);

-- Create exports table
CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  r2_key TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exports_date ON exports(date);
```

### Step 4: Shared Types

#### `workers/shared/types/track.ts`

```typescript
export interface Track {
  id: string                // Stored as tracks_normalized.external_id
  title: string
  game: string
  series?: string
  composer?: string
  platform?: string
  year?: number
  youtube_url?: string
  spotify_url?: string
}

export interface CuratedData {
  version: string
  tracks: Track[]
}
```

#### `workers/shared/types/export.ts`

```typescript
import type { Track } from './track'

export interface Choice {
  id: string
  text: string
  correct: boolean
}

export interface Reveal {
  title: string
  game: string
  composer?: string
  year?: number
  platform?: string
  series?: string
  youtube_url?: string
  spotify_url?: string
}

export interface Question {
  id: string
  track_id: number
  title: string
  game: string
  choices: Choice[]
  reveal: Reveal
  meta?: {
    difficulty?: number
    notability?: number
    quality?: number
  }
}

export interface DailyExport {
  meta: {
    date: string
    version: string
    generated_at: string
    hash: string
  }
  questions: Question[]
}
```

### Step 5: curated.json Sample

#### `workers/data/curated.json`

10問分のサンプルデータを作成 (詳細は別ドキュメント)。

### Step 6: Core Implementation

#### `workers/pipeline/src/index.ts`

Discovery と Publish の実装 (後述)。

#### `workers/api/src/index.ts`

GET /daily エンドポイントの実装 (後述)。

## Testing Strategy (Phase 1)

### Unit Tests

- `shared/lib/choices.test.ts` - 選択肢生成ロジック
- `shared/lib/hash.test.ts` - ハッシュ計算

### Integration Tests

- `tests/discovery.test.ts` - curated.json → D1 挿入
- `tests/publish.test.ts` - 問題選定 → R2 export

### E2E Tests

- `tests/api.test.ts` - GET /daily の動作確認

## Deployment (Phase 1)

### 1. Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create vgm-quiz-db
# Copy database_id to wrangler.toml

# Create R2 bucket
wrangler r2 bucket create vgm-quiz-storage

# Apply migrations
wrangler d1 migrations apply vgm-quiz-db
```

### 2. Deploy Workers

```bash
# Deploy API worker
npm run deploy:api

# Deploy Pipeline worker
npm run deploy:pipeline
```

### 3. Manual Triggers

```bash
# Trigger Discovery (once)
curl -X POST https://vgm-quiz-pipeline.your-account.workers.dev/trigger/discovery

# Trigger Publish (daily)
curl -X POST https://vgm-quiz-pipeline.your-account.workers.dev/trigger/publish?date=2025-10-10
```

### 4. Verify

```bash
# Check export
curl https://vgm-quiz-api.your-account.workers.dev/daily?date=2025-10-10
```

## Success Criteria

- [ ] `curated.json` を D1 に読み込める
- [ ] Publish で 10問選定 + 選択肢自動生成できる
- [ ] R2 に JSON export できる
- [ ] GET /daily が R2 から JSON を返す
- [ ] フロントエンドが問題を表示できる

## Next Steps (Phase 2)

1. Cron Triggers 追加 (毎日自動 Export)
2. Guard ステージ実装 (ルールベース検証)
3. Spotify API 統合 (Discovery + Harvest)
4. Score アルゴリズム改善 (Acoustic)

## Estimated Timeline

- **Setup (Step 1-2)**: 1時間
- **Migration (Step 3)**: 30分
- **Types (Step 4)**: 30分
- **Sample Data (Step 5)**: 1時間
- **Implementation (Step 6)**: 4-6時間
- **Testing**: 2時間
- **Deployment**: 1時間

**Total**: 10-12時間 (1-2日)

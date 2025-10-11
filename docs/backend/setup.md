# Development Setup – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Prerequisites

### Required
- **Node.js**: 20.x or later (LTS recommended)
- **npm**: 10.x or later
- **Cloudflare Account**: Free tier で OK

### Recommended
- **wrangler CLI**: Cloudflare Workers 開発ツール
- **Git**: Version control
- **VS Code**: + Biome extension

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/vgm-quiz.git
cd vgm-quiz
```

### 2. Install Dependencies

```bash
# Root workspace setup
npm install

# Backend dependencies
cd workers
npm install
```

### 3. Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 4. Create Cloudflare Resources

#### D1 Database

```bash
cd workers

# Create D1 database
wrangler d1 create vgm-quiz-db

# Output example:
# [[d1_databases]]
# binding = "DB"
# database_name = "vgm-quiz-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` to `workers/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

#### R2 Bucket

```bash
# Create R2 bucket
wrangler r2 bucket create vgm-quiz-storage

# Bind to wrangler.toml
```

Add to `workers/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vgm-quiz-storage"
```

### 5. Run Database Migrations

`docs/backend/schema/d1-initial.sql` に初期スキーマをまとめてあるので、ワーカー実装時にはこのファイルを `workers/migrations/0001_initial.sql` などにコピーして適用する。

```bash
cd workers

# Copy docs schema into migrations directory
mkdir -p migrations
cp ../docs/backend/schema/d1-initial.sql migrations/0001_initial.sql

# Apply migrations to D1
wrangler d1 migrations apply vgm-quiz-db
```

### 6. Set Environment Secrets

```bash
# Example: Spotify API credentials (Phase 2)
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET
```

## Development Workflow

### Local Development

```bash
cd workers

# Start local dev server (with Miniflare)
npm run dev

# API Worker runs on http://localhost:8787
# Pipeline Worker runs on http://localhost:8788
```

### Type Checking

```bash
cd workers
npm run typecheck
```

### Linting & Formatting

```bash
cd workers

# Check formatting
npm run lint

# Auto-fix
npm run lint:fix
```

### Testing

```bash
cd workers

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Manual Pipeline Execution (Local)

```bash
cd workers

# Trigger Discovery stage locally
curl -X POST http://localhost:8788/trigger/discovery

# Trigger full pipeline
curl -X POST http://localhost:8788/trigger/all
```

## Deployment

### Deploy to Cloudflare

```bash
cd workers

# Deploy API Worker
npm run deploy:api

# Deploy Pipeline Worker
npm run deploy:pipeline

# Deploy both
npm run deploy
```

### Verify Deployment

```bash
# Check deployed workers
wrangler deployments list

# Tail logs (real-time)
wrangler tail api
wrangler tail pipeline
```

## Project Structure

```
workers/
├── api/                  # API Worker
│   ├── src/
│   │   ├── index.ts     # エントリーポイント
│   │   ├── routes/      # ルートハンドラ
│   │   └── lib/         # 共通ロジック
│   └── wrangler.toml
├── pipeline/            # Pipeline Worker
│   ├── src/
│   │   ├── index.ts     # Cron エントリーポイント
│   │   ├── stages/      # 各パイプラインステージ
│   │   │   ├── discovery.ts
│   │   │   ├── harvest.ts
│   │   │   ├── guard.ts
│   │   │   ├── dedup.ts
│   │   │   ├── score.ts
│   │   │   └── publish.ts
│   │   └── lib/         # 共通ロジック
│   └── wrangler.toml
├── shared/              # 共通型定義・ユーティリティ
│   ├── types/
│   │   ├── envelope.ts  # Envelope スキーマ
│   │   ├── tracks.ts    # Track 型定義
│   │   └── api.ts       # API レスポンス型
│   └── lib/
│       ├── hash.ts      # ハッシュ計算
│       └── audit.ts     # Audit log ヘルパー
├── migrations/          # D1 migrations
│   ├── 0001_initial.sql
│   ├── 0002_add_clusters.sql
│   └── ...
├── tests/               # テスト
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── biome.json
└── wrangler.toml        # Root config
```

## Configuration Files

### `wrangler.toml` (Root)

```toml
name = "vgm-quiz-workers"
compatibility_date = "2025-10-10"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = "YOUR_DATABASE_ID"

# R2 Bucket
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vgm-quiz-storage"
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["api/src/**/*", "pipeline/src/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `biome.json`

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

### `package.json` (workers/)

```json
{
  "name": "@vgm-quiz/workers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:api": "wrangler deploy --config api/wrangler.toml",
    "deploy:pipeline": "wrangler deploy --config pipeline/wrangler.toml",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.99.0"
  }
}
```

## Common Tasks

### Add a New Migration

```bash
cd workers

# Create migration file
touch migrations/$(date +%Y%m%d%H%M%S)_description.sql

# Edit SQL file, then apply
wrangler d1 migrations apply vgm-quiz-db
```

### Query D1 Database (Local)

```bash
cd workers

# Interactive SQL shell
wrangler d1 execute vgm-quiz-db --local --command "SELECT * FROM tracks_normalized LIMIT 10"
```

### Upload Test Data to R2

```bash
cd workers

# Upload local file
wrangler r2 object put vgm-quiz-storage/exports/2025-10-10.json --file=./test-data/sample.json
```

## Troubleshooting

### Issue: `wrangler login` fails

**Solution**: Use browser authentication

```bash
wrangler login --browser
```

### Issue: D1 migrations fail with "database locked"

**Solution**: Wait a few seconds and retry

```bash
sleep 5 && wrangler d1 migrations apply vgm-quiz-db
```

### Issue: Type errors with Cloudflare Workers types

**Solution**: Update `@cloudflare/workers-types`

```bash
npm install --save-dev @cloudflare/workers-types@latest
```

### Issue: Local dev server CORS errors

**Solution**: Add CORS headers in `src/index.ts`

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
```

## Next Steps

1. Read [architecture.md](architecture.md) for system overview
2. Review [database.md](database.md) for schema details
3. Explore [pipeline/00-overview.md](pipeline/00-overview.md) for pipeline design
4. Start with Phase 1 manual curation (`workers/data/curated.json`)

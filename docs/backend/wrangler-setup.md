# Wrangler Setup Guide – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10
- **Purpose**: Cloudflare Wrangler CLI のセットアップ手順

## Prerequisites

- ✅ Node.js 20.x or later (確認: `node --version`)
- ✅ npm 10.x or later (確認: `npm --version`)
- ✅ Cloudflare アカウント (https://dash.cloudflare.com)

## Step 1: Install Wrangler

### Option A: Global Install (推奨)

```bash
npm install -g wrangler

# Verify installation
wrangler --version
# Expected: 3.99.0 or later
```

### Option B: Project Local Install

```bash
cd workers
npm install -D wrangler

# Use via npx
npx wrangler --version
```

## Step 2: Login to Cloudflare

### Interactive Login

```bash
wrangler login
```

このコマンドを実行すると:
1. ブラウザが自動で開きます
2. Cloudflare にログイン (既にログイン済みならスキップ)
3. "Allow Wrangler?" の確認画面が表示
4. **"Allow"** をクリック
5. ターミナルに戻ると "Successfully logged in!" と表示

### 認証確認

```bash
wrangler whoami
```

**出力例**:
```
👷 You are logged in with an OAuth Token, associated with the email 'your-email@example.com'!
┌──────────────────────────┬──────────────────────────────────┐
│ Account Name             │ Account ID                        │
├──────────────────────────┼──────────────────────────────────┤
│ Your Account             │ abc123...                         │
└──────────────────────────┴──────────────────────────────────┘
```

**Account ID** をメモしてください (後で使用)。

## Step 3: Create D1 Database

### Create Database

```bash
cd workers
wrangler d1 create vgm-quiz-db
```

**出力例**:
```
✅ Successfully created DB 'vgm-quiz-db'!

[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = "12345678-abcd-efgh-ijkl-0123456789ab"
```

### Update wrangler.toml

上記の出力をコピーして、以下のファイルに貼り付け:

**`workers/api/wrangler.toml`**:
```toml
name = "vgm-quiz-api"
main = "src/index.ts"
compatibility_date = "2025-10-10"

[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = "12345678-abcd-efgh-ijkl-0123456789ab"  # ← ここに貼り付け
```

**`workers/pipeline/wrangler.toml`**:
```toml
name = "vgm-quiz-pipeline"
main = "src/index.ts"
compatibility_date = "2025-10-10"

[[d1_databases]]
binding = "DB"
database_name = "vgm-quiz-db"
database_id = "12345678-abcd-efgh-ijkl-0123456789ab"  # ← 同じ ID
```

### Verify Database

```bash
wrangler d1 list
```

**出力例**:
```
┌──────────────────────────────────┬──────────────┐
│ database_id                      │ name         │
├──────────────────────────────────┼──────────────┤
│ 12345678-abcd-efgh-ijkl-01234... │ vgm-quiz-db  │
└──────────────────────────────────┴──────────────┘
```

## Step 4: Create R2 Bucket

### Create Bucket

```bash
wrangler r2 bucket create vgm-quiz-storage
```

**出力例**:
```
✅ Created bucket 'vgm-quiz-storage' with default storage class set to Standard.
```

### Update wrangler.toml

**`workers/api/wrangler.toml`** に追加:
```toml
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vgm-quiz-storage"
```

**`workers/pipeline/wrangler.toml`** にも同じものを追加。

### Verify Bucket

```bash
wrangler r2 bucket list
```

**出力例**:
```
┌───────────────────┬──────────────────────────┐
│ name              │ creation-date            │
├───────────────────┼──────────────────────────┤
│ vgm-quiz-storage  │ 2025-10-10T12:00:00.000Z │
└───────────────────┴──────────────────────────┘
```

## Step 5: Apply Database Migrations

### Create Migration File

`docs/backend/schema/d1-initial.sql` をベースに **`workers/migrations/0001_initial.sql`** を作成:

```bash
cd workers
mkdir -p migrations
cp ../docs/backend/schema/d1-initial.sql migrations/0001_initial.sql
```

### Apply Migration (Local)

```bash
cd workers
wrangler d1 migrations apply vgm-quiz-db --local
```

**出力例**:
```
Migrations to be applied:
┌────────────────────┬────────────────────┐
│ Name               │ Status             │
├────────────────────┼────────────────────┤
│ 0001_initial.sql   │ Pending            │
└────────────────────┴────────────────────┘

? Ok to apply 1 migration(s)? › (Y/n)
```

**Y** を押して適用。

### Apply Migration (Remote)

```bash
wrangler d1 migrations apply vgm-quiz-db --remote
```

**注意**: `--remote` は本番環境に適用。最初はローカルでテストしてから実行。

### Verify Migration

```bash
wrangler d1 execute vgm-quiz-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

**出力例**:
```
┌──────────────────────┐
│ name                 │
├──────────────────────┤
│ sources              │
│ tracks_normalized    │
│ pool                 │
│ picks                │
│ exports              │
└──────────────────────┘
```

## Step 6: Local Development

### Start Dev Server (API)

```bash
cd workers
wrangler dev --config api/wrangler.toml
```

**出力例**:
```
⛅️ wrangler 3.99.0
-------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

ブラウザで http://localhost:8787 を開く。

### Start Dev Server (Pipeline)

別のターミナルで:

```bash
cd workers
wrangler dev --config pipeline/wrangler.toml --port 8788
```

**出力例**:
```
⛅️ wrangler 3.99.0
-------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8788
```

### Test Endpoint

```bash
curl http://localhost:8787/health
# Expected: {"status":"ok"}
```

## Step 7: Deploy to Production

### Deploy API Worker

```bash
cd workers
wrangler deploy --config api/wrangler.toml
```

**出力例**:
```
Total Upload: 2.34 KiB / gzip: 1.05 KiB
Uploaded vgm-quiz-api (1.23 sec)
Published vgm-quiz-api (0.45 sec)
  https://vgm-quiz-api.your-account.workers.dev
Current Deployment ID: abc123...
```

### Deploy Pipeline Worker

```bash
wrangler deploy --config pipeline/wrangler.toml
```

### Verify Deployment

```bash
wrangler deployments list --name vgm-quiz-api
```

**出力例**:
```
┌────────────┬──────────────────────────┬──────────────────────────┐
│ Created    │ Deployment ID            │ Version ID               │
├────────────┼──────────────────────────┼──────────────────────────┤
│ 2025-10-10 │ abc123...                │ v1                       │
└────────────┴──────────────────────────┴──────────────────────────┘
```

## Common Commands

### D1 Database

```bash
# List databases
wrangler d1 list

# Execute SQL (local)
wrangler d1 execute vgm-quiz-db --local --command "SELECT * FROM tracks_normalized LIMIT 5"

# Execute SQL (remote)
wrangler d1 execute vgm-quiz-db --remote --command "SELECT COUNT(*) FROM tracks_normalized"

# Interactive shell (local)
wrangler d1 execute vgm-quiz-db --local

# Export database
wrangler d1 export vgm-quiz-db --local --output=backup.sql
```

### R2 Bucket

```bash
# List buckets
wrangler r2 bucket list

# List objects
wrangler r2 object list vgm-quiz-storage

# Upload file
wrangler r2 object put vgm-quiz-storage/test.json --file=./test.json

# Download file
wrangler r2 object get vgm-quiz-storage/test.json --file=./downloaded.json

# Delete file
wrangler r2 object delete vgm-quiz-storage/test.json
```

### Workers

```bash
# List workers
wrangler deployments list

# Tail logs (real-time)
wrangler tail vgm-quiz-api

# Delete worker
wrangler delete vgm-quiz-api
```

### Secrets

```bash
# Set secret
wrangler secret put SPOTIFY_CLIENT_ID --name vgm-quiz-api

# List secrets
wrangler secret list --name vgm-quiz-api

# Delete secret
wrangler secret delete SPOTIFY_CLIENT_ID --name vgm-quiz-api
```

## Troubleshooting

### Issue: `wrangler login` fails

**Solution 1**: Use manual browser authentication
```bash
wrangler login --browser
```

**Solution 2**: Use API token
```bash
export CLOUDFLARE_API_TOKEN=your-token-here
wrangler whoami
```

### Issue: D1 migrations fail with "database locked"

**Solution**: Wait a few seconds and retry
```bash
sleep 5
wrangler d1 migrations apply vgm-quiz-db --local
```

### Issue: R2 bucket creation fails

**Solution**: Check account limits
```bash
wrangler r2 bucket list
# Free tier: 10 buckets max
```

### Issue: `wrangler dev` port already in use

**Solution**: Specify different port
```bash
wrangler dev --config api/wrangler.toml --port 8788
```

### Issue: Type errors with Workers types

**Solution**: Update types
```bash
npm install --save-dev @cloudflare/workers-types@latest
```

## Next Steps

1. ✅ Wrangler CLI インストール完了
2. ✅ Cloudflare ログイン完了
3. ✅ D1 Database 作成完了
4. ✅ R2 Bucket 作成完了
5. ✅ Migration 適用完了

→ **実装開始準備完了!**

次は [phase1-implementation.md](../dev/phase1-implementation.md) の Step 6 (Core Implementation) に進みます。

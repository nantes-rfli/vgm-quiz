# Cron Triggers Testing Guide – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-13
- **Purpose**: Manual testing procedures for Pipeline Worker scheduled execution

## Overview

This document provides testing procedures for verifying:
1. Cron Triggers configuration
2. Idempotency (running publish twice for same date)
3. Scheduled handler execution
4. Logging output

## Prerequisites

- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare account with Workers and D1/R2 access
- Pipeline Worker deployed to production

## Test 1: Idempotency Verification (Local)

**Goal**: Verify that running publish twice for the same date does not cause errors.

### Setup

1. Start Pipeline Worker locally:
   ```bash
   cd workers
   npm run dev:pipeline
   ```

2. Ensure D1 is empty or has test data:
   ```bash
   wrangler d1 execute vgm-quiz-db --local --command "DELETE FROM picks"
   wrangler d1 execute vgm-quiz-db --local --command "DELETE FROM exports"
   ```

### Test Steps

**Step 1**: Run discovery (sync curated.json)
```bash
curl -X POST http://localhost:8788/trigger/discovery
```

**Expected output**:
```json
{
  "success": true,
  "tracksInserted": 20,
  "tracksUpdated": 0,
  "errors": []
}
```

**Step 2**: Run publish for specific date (first time)
```bash
curl -X POST "http://localhost:8788/trigger/publish?date=2025-10-13"
```

**Expected output**:
```json
{
  "success": true,
  "date": "2025-10-13",
  "questionsGenerated": 10,
  "r2Key": "exports/2025-10-13.json",
  "hash": "abc123..."
}
```

**Expected logs**:
```
[Publish] START: Generating question set for date=2025-10-13
[Publish] R2: Exported to exports/2025-10-13.json
[Publish] SUCCESS: 10 questions generated for 2025-10-13
[Publish] Hash: abc123...
```

**Step 3**: Run publish again (second time, same date)
```bash
curl -X POST "http://localhost:8788/trigger/publish?date=2025-10-13"
```

**Expected output**:
```json
{
  "success": false,
  "date": "2025-10-13",
  "questionsGenerated": 0,
  "error": "Question set already exists"
}
```

**Expected logs**:
```
[Publish] START: Generating question set for date=2025-10-13
[Publish] SKIP: Question set for 2025-10-13 already exists (pick_id=1)
```

**Verification**:
- ✅ Second execution returns early without error
- ✅ No duplicate entries in D1 `picks` table
- ✅ R2 file exists and is valid JSON

## Test 2: Scheduled Handler Simulation (Local)

**Goal**: Verify scheduled handler logic without waiting for actual Cron execution.

### Approach

Since Cron Triggers only run in production, we simulate the scheduled handler by calling the stages directly.

**Option A: Use Wrangler Test Mode (Future)**

Wrangler does not currently support triggering scheduled events locally. For now, test manually via HTTP endpoints.

**Option B: Manual Verification**

1. Deploy to staging/production
2. Wait for next scheduled execution (00:00 JST = 15:00 UTC)
3. Check Cloudflare Workers logs

## Test 3: Production Deployment & Monitoring

**Goal**: Verify Cron Triggers work in production.

### Deployment

1. Deploy Pipeline Worker:
   ```bash
   cd workers
   npm run deploy:pipeline
   ```

2. Verify Cron Triggers are configured:
   ```bash
   wrangler deployments list --name vgm-quiz-pipeline
   ```

   **Expected output** (includes `triggers` section):
   ```
   Created:  YYYY-MM-DD HH:MM:SS
   Triggers:
     - cron: 0 15 * * *
   ```

### Monitoring

**Step 1**: Check next scheduled execution time

Cloudflare Dashboard → Workers & Pages → vgm-quiz-pipeline → Triggers

**Expected**: Shows "0 15 * * *" (daily at 15:00 UTC)

**Step 2**: Wait for scheduled execution

Check logs immediately after 00:00 JST (15:00 UTC):

```bash
wrangler tail vgm-quiz-pipeline
```

**Expected logs**:
```
[Cron] START: Daily pipeline execution
[Cron] Scheduled time: 2025-10-13T15:00:00.000Z
[Cron] Cron expression: 0 15 * * *
[Cron] Running discovery stage...
[Discovery] START: Processing 20 tracks from curated.json
[Discovery] SUCCESS: 0 inserted, 20 updated
[Cron] Running publish stage...
[Publish] START: Generating question set for date=2025-10-13
[Publish] R2: Exported to exports/2025-10-13.json
[Publish] SUCCESS: 10 questions generated for 2025-10-13
[Cron] SUCCESS: Pipeline completed successfully
```

**Step 3**: Verify outputs

Check D1:
```bash
wrangler d1 execute vgm-quiz-db --remote --command \
  "SELECT date, status FROM picks ORDER BY date DESC LIMIT 5"
```

Check R2:
```bash
wrangler r2 object get vgm-quiz-storage/exports/2025-10-13.json
```

**Verification**:
- ✅ Cron Trigger executed at scheduled time
- ✅ Discovery and publish stages completed successfully
- ✅ D1 `picks` and `exports` tables updated
- ✅ R2 file exists and is valid JSON

## Test 4: Idempotency in Production

**Goal**: Verify idempotency guards prevent duplicate generation.

### Manual Trigger After Cron

After Cron has run (e.g., today's question set already generated), manually trigger publish:

```bash
curl -X POST "https://vgm-quiz-pipeline.nantos.workers.dev/trigger/publish?date=$(date +%Y-%m-%d)"
```

**Expected output**:
```json
{
  "success": false,
  "date": "2025-10-13",
  "questionsGenerated": 0,
  "error": "Question set already exists"
}
```

**Expected logs**:
```
[Publish] START: Generating question set for date=2025-10-13
[Publish] SKIP: Question set for 2025-10-13 already exists (pick_id=42)
```

**Verification**:
- ✅ Manual trigger does not overwrite existing question set
- ✅ No duplicate entries in D1
- ✅ R2 file remains unchanged

## Test 5: Concurrent Execution Simulation

**Goal**: Verify behavior when two publish requests run concurrently (rare edge case).

### Approach

Send two simultaneous requests for the same date:

```bash
curl -X POST "http://localhost:8788/trigger/publish?date=2025-10-14" &
curl -X POST "http://localhost:8788/trigger/publish?date=2025-10-14" &
wait
```

**Expected behavior**:
- One request completes successfully
- Other request returns "already exists" error
- No constraint violations in D1

**Note**: This is best-effort testing. True race conditions are difficult to reproduce locally. In production, `INSERT OR REPLACE` ensures no errors occur.

## Test 6: Error Scenario - R2 Failure

**Goal**: Verify recovery when R2 PUT fails.

### Simulation

1. Temporarily revoke R2 access (or use invalid bucket name in wrangler.toml)
2. Run publish
3. Verify error handling

**Expected logs**:
```
[Publish] START: Generating question set for date=2025-10-15
[Publish] ERROR: Failed for date=2025-10-15
```

**Expected output**:
```json
{
  "success": false,
  "date": "2025-10-15",
  "questionsGenerated": 0,
  "error": "R2 bucket not found"
}
```

**Recovery**:
1. Fix R2 configuration
2. Re-run publish
3. Verify question set is generated successfully

## Test 7: Discovery Failure Handling

**Goal**: Verify Cron aborts when discovery fails.

### Simulation

1. Introduce invalid data in `curated.json` (e.g., duplicate ID)
2. Trigger Cron execution (or call discovery manually)
3. Verify publish is not executed

**Expected logs**:
```
[Cron] START: Daily pipeline execution
[Cron] Running discovery stage...
[Discovery] ERROR: Failed to upsert track 021: UNIQUE constraint failed
[Discovery] FAILURE: 1 errors occurred
[Cron] Discovery stage failed, aborting pipeline
```

**Verification**:
- ✅ Cron stops after discovery failure
- ✅ Publish stage is not executed
- ✅ No partial data is written to D1/R2

## Success Criteria

### Phase 1 (MVP) Requirements

- [x] Cron Triggers configured in wrangler.toml
- [x] Scheduled handler executes discovery + publish
- [x] Idempotency guards prevent duplicate generation
- [x] Logging shows START/SUCCESS/ERROR for each stage
- [x] R2 PUT operation overwrites existing files safely
- [x] D1 uses INSERT OR REPLACE for idempotency

### Future Enhancements (Phase 2+)

- [ ] Distributed lock to prevent concurrent execution
- [ ] Alerting on failure (Slack/Email webhook)
- [ ] Automatic R2 cleanup (delete old exports)
- [ ] Metrics dashboard (R2 usage, success rate)

## Related Documentation

- [R2 Cache Strategy](r2-cache-strategy.md)
- [Phase 1 Implementation](phase1-implementation.md)
- [Backend Architecture](architecture.md)

# R2 Cache Strategy – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-13
- **Purpose**: R2 storage strategy for daily question set exports

## Overview

Pipeline Worker generates daily question sets and exports them to Cloudflare R2. This document defines the caching, overwrite, and deletion policies for these exports.

## R2 Object Structure

### File Naming Convention

```
exports/YYYY-MM-DD.json
```

**Examples:**
- `exports/2025-10-13.json`
- `exports/2025-10-14.json`

### File Format

Each export file contains:
- `meta`: Metadata (date, version, generated_at, hash)
- `questions`: Array of 10 questions with choices and reveal metadata

**Example:**
```json
{
  "meta": {
    "date": "2025-10-13",
    "version": "1.0.0",
    "generated_at": "2025-10-12T15:00:01.234Z",
    "hash": "abc123..."
  },
  "questions": [...]
}
```

## Overwrite Policy

### Idempotent PUT Operations

**Behavior**: R2 PUT operations naturally overwrite existing files.

**Rationale**:
- If Cron Trigger runs twice for same date (e.g., manual retry), the second execution will overwrite the first
- This is acceptable because question sets are deterministic (same date → same random seed → same selection)
- Hash verification ensures data integrity

**Implementation**: [workers/pipeline/src/stages/publish.ts:154-160](../../workers/pipeline/src/stages/publish.ts#L154-L160)

```typescript
// 10. Export to R2 (PUT operation is naturally idempotent - overwrites existing)
const r2Key = `exports/${date}.json`
await env.STORAGE.put(r2Key, JSON.stringify(exportData, null, 2), {
  httpMetadata: {
    contentType: 'application/json',
  },
})
```

### D1 Consistency Check

Before overwriting, Pipeline Worker checks D1 `picks` table:
- If entry exists → Skip generation (early return)
- If entry does not exist → Generate and export

**Edge case**: If D1 entry exists but R2 file is missing (e.g., manual deletion), a warning is logged but no re-export occurs.

**Implementation**: [workers/pipeline/src/stages/publish.ts:43-66](../../workers/pipeline/src/stages/publish.ts#L43-L66)

## Cache-Control Headers

### API Worker Response Headers

When serving exports via API Worker (`GET /daily?date=YYYY-MM-DD`):

```http
Cache-Control: public, max-age=86400, immutable
Content-Type: application/json
ETag: "<hash>"
```

**Rationale**:
- `max-age=86400` (24 hours): Exports are static for a given date
- `immutable`: Once published, exports never change (deterministic generation)
- `ETag`: Client can use `If-None-Match` for conditional requests

**Note**: Cache-Control implementation is future work (not yet implemented in API Worker).

## Deletion Policy

### Phase 1 (MVP): Manual Deletion Only

**Current state**: No automatic deletion.

**Rationale**:
- R2 storage is cheap (~$0.015/GB/month)
- Historical exports may be useful for analytics or debugging
- Deletion can be performed manually via Wrangler CLI or Cloudflare Dashboard

### Future: Automatic Cleanup (Phase 2+)

**Proposal**: Keep last 60 days, delete older exports.

**Implementation approach**:
1. Add cleanup task to scheduled handler (runs weekly)
2. List objects older than 60 days: `env.STORAGE.list({ prefix: 'exports/' })`
3. Delete objects: `env.STORAGE.delete(key)`

**Example (future):**
```typescript
async function cleanupOldExports(env: Env): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 60) // 60 days ago

  const list = await env.STORAGE.list({ prefix: 'exports/' })

  for (const object of list.objects) {
    const dateMatch = object.key.match(/exports\/(\d{4}-\d{2}-\d{2})\.json/)
    if (dateMatch) {
      const fileDate = new Date(dateMatch[1])
      if (fileDate < cutoffDate) {
        await env.STORAGE.delete(object.key)
        console.log(`[Cleanup] Deleted old export: ${object.key}`)
      }
    }
  }
}
```

## Monitoring

### Recommended Metrics (Future)

- R2 storage usage (GB)
- Daily export count
- Failed publish attempts
- Missing R2 files (D1 entry exists but R2 missing)

### Cloudflare Dashboard

View R2 bucket usage:
1. Cloudflare Dashboard → R2 → `vgm-quiz-storage`
2. Check "Objects" count and "Storage" size

## Operational Commands

### List All Exports

```bash
wrangler r2 object list vgm-quiz-storage --prefix exports/
```

### Download Specific Export

```bash
wrangler r2 object get vgm-quiz-storage/exports/2025-10-13.json
```

### Delete Specific Export

```bash
wrangler r2 object delete vgm-quiz-storage/exports/2025-10-13.json
```

### Verify D1 Consistency

```bash
# List all dates in picks table
wrangler d1 execute vgm-quiz-db --remote --command "SELECT date FROM picks ORDER BY date DESC LIMIT 10"

# Check if R2 file exists for specific date
wrangler r2 object head vgm-quiz-storage/exports/2025-10-13.json
```

## Error Handling

### Scenario 1: R2 PUT Fails

**Symptom**: D1 `exports` table has entry, but R2 file is missing.

**Recovery**:
1. Check Cloudflare Workers logs for R2 errors
2. Re-run publish: `POST /trigger/publish?date=YYYY-MM-DD`
3. Pipeline Worker will skip D1 insert (idempotent) and retry R2 PUT

### Scenario 2: D1 INSERT Fails, R2 PUT Succeeds

**Symptom**: R2 file exists, but D1 `exports` table has no entry.

**Recovery**:
1. Check D1 logs for constraint violations or errors
2. Manually insert into `exports` table:
   ```sql
   INSERT INTO exports (date, r2_key, version, hash)
   VALUES ('2025-10-13', 'exports/2025-10-13.json', '1.0.0', '<hash>');
   ```
3. Hash can be read from R2 file's `meta.hash` field

### Scenario 3: Concurrent Cron Execution

**Symptom**: Two Cron Triggers run simultaneously (rare, but possible if previous execution is delayed).

**Mitigation**:
1. D1 early-exit check prevents duplicate generation
2. `INSERT OR REPLACE` ensures no constraint violations
3. Last execution's R2 PUT wins (overwrites)

**Note**: For strict locking, consider future enhancement with D1 flag (e.g., `pipeline_lock` table).

## Related Documentation

- [Backend Architecture](architecture.md)
- [Phase 1 Implementation](../dev/phase1-implementation.md)
- [Database Schema](database.md)
- [Curated Data Format](curated-data-format.md)

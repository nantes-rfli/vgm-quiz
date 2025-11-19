# R2 Cache Strategy – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-11-19
- **Purpose**: R2 storage strategy for daily question set exports

## Overview

Pipeline Worker generates daily question sets and exports them to Cloudflare R2. This document defines the caching, overwrite, and deletion policies for these exports.

## R2 Object Structure

### File Naming Convention

```
exports/daily/YYYY-MM-DD.json
backups/daily/YYYY-MM-DD.json
```

**Examples:**
- `exports/daily/2025-10-13.json`
- `backups/daily/2025-10-13.json`

バックアップは canonical export と同じ日付サフィックスを共有し、`customMetadata.source = "daily"` を付与して R2 側で識別できる。`BACKUP_PREFIX`（既定: `backups/daily`）を変更すると階層全体が切り替わる。

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

**Implementation**: [workers/pipeline/src/stages/publish.ts](../../workers/pipeline/src/stages/publish.ts)

```typescript
const r2Key = buildExportR2Key(date, CANONICAL_FILTER_KEY)
await env.STORAGE.put(r2Key, exportJsonPretty, { httpMetadata: { contentType: 'application/json' } })

if (filterKey === CANONICAL_FILTER_KEY) {
  await replicateCanonicalBackup(env, {
    canonicalKey: r2Key,
    exportJson: exportJsonPretty,
    date,
    hash,
  })
}
```

`replicateCanonicalBackup` は `BACKUP_PREFIX` プレフィックスへコピーし、`BACKUP_EXPORT_DAYS` を下回る古いバックアップを自動削除する。

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

## Deletion & Retention Policy

- `exports/daily/*`: アーカイブ用途があるため自動削除は行わない。将来的なクリーンアップは別ジョブ（未実装）で検討する。
- `backups/daily/*`: Pipeline Worker が `BACKUP_EXPORT_DAYS`（既定 14 日）を下回らないように削除し、R2 Lifecycle ルールで 30 日を上限にした自動削除を構成する。

**Lifecycle Configuration Example**

```bash
wrangler r2 bucket lifecycle put vgm-quiz-storage --rules '[
  {"ID":"backups-30d","Prefix":"backups/","Status":"Enabled","Expiration":{"Days":30}}
]'
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
wrangler r2 object list vgm-quiz-storage --prefix backups/daily/
```

### Download Specific Export

```bash
wrangler r2 object get vgm-quiz-storage/exports/daily/2025-10-13.json
wrangler r2 object get vgm-quiz-storage/backups/daily/2025-10-13.json
```

### Delete Specific Export

```bash
wrangler r2 object delete vgm-quiz-storage/exports/daily/2025-10-13.json
wrangler r2 object delete vgm-quiz-storage/backups/daily/2025-10-13.json
```

### Verify D1 Consistency

```bash
# List all dates in picks table
wrangler d1 execute vgm-quiz-db --remote --command "SELECT date FROM picks ORDER BY date DESC LIMIT 10"

# Check if R2 file exists for specific date
wrangler r2 object head vgm-quiz-storage/exports/daily/2025-10-13.json
wrangler r2 object head vgm-quiz-storage/backups/daily/2025-10-13.json
```

### Snapshot & Recovery Script

- `npm run export:snapshot -- --start 2025-11-01 --end 2025-11-05` — D1 `picks` (`filters_json='{}'`) から canonical export を取得し、`exports/daily/` に PUT。R2 認証には `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` を使用する。
- `npm run export:snapshot -- --start 2025-11-01 --end 2025-11-05 --source backup --force` — `backups/daily/` から `exports/daily/` へサーバーサイドコピー（`CopyObject`）。

**必須環境変数**:

| Name | Purpose |
|------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | API / R2 endpoint selection |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 target DB (source=d1) |
| `CLOUDFLARE_API_TOKEN` | D1 raw query API token |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | S3-compatible credentials |
| `R2_BUCKET_NAME` | Target R2 bucket (e.g., `vgm-quiz-storage`) |
| `BACKUP_PREFIX` | Optional. Defaults to `backups/daily` |

## Error Handling

### Scenario 1: R2 PUT Fails

**Symptom**: D1 `exports` table has entry, but R2 file is missing.

**Recovery**:
1. Check Cloudflare Workers logs for R2 errors
2. 暫定提供が必要な場合は `GET /daily?date=YYYY-MM-DD&backup=1` でバックアップを即時配信する
3. `npm run export:snapshot -- --start YYYY-MM-DD --end YYYY-MM-DD` で D1 から再出力
4. もしくは Pipeline Worker を再実行: `POST /trigger/publish?date=YYYY-MM-DD`
5. Pipeline Worker は D1 をスキップし、R2/backup の両方へ再 PUT する

### Scenario 2: D1 INSERT Fails, R2 PUT Succeeds

**Symptom**: R2 file exists, but D1 `exports` table has no entry.

**Recovery**:
1. Check D1 logs for constraint violations or errors
2. Manually insert into `exports` table:
   ```sql
   INSERT INTO exports (date, r2_key, version, hash)
   VALUES ('2025-10-13', 'exports/daily/2025-10-13.json', '1.0.0', '<hash>');
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

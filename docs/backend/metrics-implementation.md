# Metrics Implementation (Phase 1)

- Status: Implemented
- Last Updated: 2025-10-12

## Overview

Phase 1 implementation of the metrics ingestion endpoint (`POST /v1/metrics`) for collecting anonymous analytics events from the frontend client.

## Architecture

### Database Schema

Two tables support metrics collection:

#### `metrics_events`
Stores all ingested events with full metadata.

```sql
CREATE TABLE metrics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,              -- UUID from client
  client_id TEXT NOT NULL,              -- Anonymous client identifier
  event_name TEXT NOT NULL,             -- Event vocabulary (answer_select, etc.)
  event_ts TIMESTAMP NOT NULL,          -- Client event timestamp (ISO8601)
  round_id TEXT,                        -- Optional round token
  question_idx INTEGER,                 -- Optional question index (1-based)
  attrs TEXT,                           -- JSON-encoded event attributes
  app_version TEXT,                     -- Client app version
  tz TEXT,                              -- Client timezone offset
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Indexes:
- `idx_metrics_client_event` on `(client_id, event_id)` - Fast deduplication lookups
- `idx_metrics_received_at` on `received_at` - Time-range queries
- `idx_metrics_event_name` on `event_name` - Event type filtering

#### `metrics_deduplication`
24-hour deduplication cache.

```sql
CREATE TABLE metrics_deduplication (
  client_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, event_id)
);
```

Index:
- `idx_metrics_dedup_received_at` on `received_at` - Cleanup of old entries

### Endpoint: `POST /v1/metrics`

**Request:**
```json
{
  "client": {
    "client_id": "c0b9b2dc-...-c2f",
    "app_version": "0.1.0",
    "tz": "+09:00"
  },
  "events": [
    {
      "id": "f2b6e4aa-...-3d7",
      "name": "answer_select",
      "ts": "2025-09-20T12:34:56.789Z",
      "round_id": "2c5e...",
      "question_idx": 3,
      "attrs": { "choice": "B" }
    }
  ]
}
```

**Response:**
- Success: `202 Accepted` (no body)
- Validation error: `400 Bad Request` with error details
- Payload too large: `413 Payload Too Large`
- Rate limited: `429 Too Many Requests` with `Retry-After` header
- Internal error: `500 Internal Server Error`

### Validation Rules

1. **Batch limits:**
   - Events: 1-100 per batch
   - Body size: ≤ 256 KB
   - Attrs size: ≤ 2 KB per event (recommended)

2. **Required fields:**
   - `client.client_id` (string)
   - `events[].id` (string, UUID format)
   - `events[].name` (string, must be in allowed vocabulary)
   - `events[].ts` (ISO8601 string, ±24 hours tolerance)

3. **Allowed event names:**
   - `answer_select`
   - `answer_result`
   - `quiz_complete`
   - `reveal_open_external`
   - `embed_error`
   - `embed_fallback_to_link`
   - `settings_inline_toggle`
   - `settings_theme_toggle`
   - `settings_locale_toggle`
   - `artwork_open`

### Deduplication Strategy

1. **Key:** `(client_id, event_id)` composite primary key
2. **Window:** 24 hours
3. **Cleanup:** Probabilistic (10% of requests) to delete entries >24h old
4. **Behavior:** Duplicate events are silently accepted (202) but not inserted

### Implementation Details

**File:** [workers/api/src/routes/metrics.ts](../../workers/api/src/routes/metrics.ts)

Key functions:
- `validateBatch()` - Comprehensive payload validation
- `isDuplicate()` - Check deduplication table
- `insertEvent()` - Insert into both tables atomically
- `cleanupDeduplication()` - Remove old dedup entries
- `handleMetricsRequest()` - Main request handler

**CORS Headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Idempotency-Key
```

### Error Handling

Errors during individual event insertion are logged but don't fail the entire batch. This ensures partial success when possible.

**Example error response:**
```json
{
  "error": "validation_error",
  "message": "Validation failed",
  "details": [
    {
      "field": "events[0].name",
      "message": "name \"invalid_event\" is not in allowed vocabulary"
    }
  ]
}
```

## Testing

### Local Development

1. **Start API Worker:**
   ```bash
   cd workers
   npm run dev:api
   ```
   Server runs on `http://localhost:8787`

2. **Test valid request:**
   ```bash
   curl -X POST http://localhost:8787/v1/metrics \
     -H "Content-Type: application/json" \
     -d '{
       "client": {
         "client_id": "test-client-123",
         "app_version": "0.1.0",
         "tz": "+09:00"
       },
       "events": [
         {
           "id": "e1234567-89ab-cdef-0123-456789abcdef",
           "name": "answer_select",
           "ts": "2025-10-12T07:00:00.000Z",
           "round_id": "test-round-1",
           "question_idx": 1,
           "attrs": {
             "questionId": "q_0001",
             "choiceId": "a"
           }
         }
       ]
     }'
   ```
   Expected: `HTTP/1.1 202 Accepted`

3. **Test validation error:**
   ```bash
   curl -X POST http://localhost:8787/v1/metrics \
     -H "Content-Type: application/json" \
     -d '{
       "client": { "client_id": "test" },
       "events": [{
         "id": "test",
         "name": "invalid_event",
         "ts": "2025-10-12T07:00:00.000Z"
       }]
     }'
   ```
   Expected: `HTTP/1.1 400 Bad Request` with validation errors

4. **Verify database:**
   ```bash
   npx wrangler d1 execute vgm-quiz-db --local \
     --command "SELECT * FROM metrics_events ORDER BY received_at DESC LIMIT 5"
   ```

5. **Test deduplication:**
   Send the same event twice with identical `client_id` and `event_id`.
   Verify only one row exists in database.

### Frontend Integration

Set `NEXT_PUBLIC_API_MOCK=0` in `web/.env.local` to connect to the real backend:

```bash
cd web
echo "NEXT_PUBLIC_API_MOCK=0" >> .env.local
npm run dev
```

The metrics client will automatically send events to `http://localhost:8787/v1/metrics`.

## Deployment

### Apply Migration to Production

```bash
cd workers
npx wrangler d1 migrations apply vgm-quiz-db --remote
```

### Deploy API Worker

```bash
cd workers
npm run deploy:api
```

After deployment, the metrics endpoint will be available at:
`https://vgm-quiz-api.nantos.workers.dev/v1/metrics`

### Update Frontend Environment

Update `NEXT_PUBLIC_API_BASE_URL` in production environment to point to the deployed worker.

## Monitoring

**Key Metrics to Track:**
- Request rate (requests/min)
- Event ingestion rate (events/sec)
- Validation error rate
- Deduplication hit rate
- Database write latency
- 4xx/5xx error rates

**Useful D1 Queries:**

```sql
-- Event volume by type (last 24h)
SELECT event_name, COUNT(*) as count
FROM metrics_events
WHERE received_at > datetime('now', '-1 day')
GROUP BY event_name
ORDER BY count DESC;

-- Top clients by event count
SELECT client_id, COUNT(*) as event_count
FROM metrics_events
WHERE received_at > datetime('now', '-1 day')
GROUP BY client_id
ORDER BY event_count DESC
LIMIT 10;

-- Deduplication cache size
SELECT COUNT(*) as dedup_cache_size
FROM metrics_deduplication;
```

## Future Enhancements (Not in Phase 1)

1. **Rate Limiting:**
   - Per-IP limits
   - Per-client_id limits
   - Dynamic thresholds based on load

2. **Idempotency-Key Support:**
   - Full request-level deduplication
   - Cached response replay

3. **Batch Processing Optimization:**
   - Async event insertion
   - Batch writes to reduce D1 latency

4. **Analytics Aggregation:**
   - Pre-computed hourly/daily metrics
   - Real-time dashboards

5. **Data Retention:**
   - Automated archival to R2
   - Configurable retention periods

6. **Enhanced Monitoring:**
   - Cloudflare Analytics integration
   - Custom alerts for anomalies

## References

- [Metrics Ingest API Specification](../api/metrics-endpoint.md)
- [Frontend Metrics Client Documentation](../frontend/metrics-client.md)
- [API Error Model](../api/error-model.md)
- [Database Schema](./database.md)

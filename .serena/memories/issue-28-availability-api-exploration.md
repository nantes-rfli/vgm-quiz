# Issue #28: Availability API - Backend Codebase Exploration

## Project Phase & Status
- **Phase**: 2B (Manifest & API 刷新)
- **API Spec**: Section 3.5 in `/docs/api/api-spec.md` (lines 130-141)
- **Priority**: P3 (Optional but recommended)
- **Status in Roadmap**: Not yet started (line 71 in `/docs/dev/roadmap.md`)

## Expected API Endpoint
```
POST /v1/availability
Body: { "mode": "vgm_v1-ja", "filters": { "era": ["90s"], "difficulty": ["mixed"] } }
Response: { "available": <count> }
```

## Key Findings

### 1. API Worker Structure
- **Location**: `/workers/api/src/index.ts`
- **Main entry point**: Line 7-72
- **Pattern**: URL path matching + handler delegation pattern
- **Existing endpoints**:
  - GET `/daily` (line 27-29)
  - GET `/v1/rounds/start` (line 31-34)
  - POST `/v1/rounds/next` (line 36-39)
  - POST `/v1/metrics` (line 41-44)
  - GET `/health` (line 46-51)
- **CORS headers** already set up (lines 10-15)
- **New endpoint would follow same pattern**: Add route check and delegate to handler function

### 2. Filtering Logic Implementation (Issue #111)
**Location**: `/workers/pipeline/src/stages/publish.ts`

#### Filter Key Management (lines 58-78)
- Function `getFilterKey(filters?: FilterOptions)`: Normalizes filters to consistent JSON
- Ensures empty objects and undefined both map to '{}'
- Sorts keys for consistent ordering
- For arrays (like `series`), sorts the values

#### Filter Hash for R2 Keys (lines 84-93)
- Function `hashFilterKey(filterJson: string)`: Creates short hash for R2 key distinction
- Format: `exports/${date}_${hashFilterKey(filterKey)}.json` for filtered exports
- Canonical (no filters) format: `exports/${date}.json`

#### Track Selection with Filters (lines 324-369)
- Function `selectTracks(db, count, filters)`: Selects random tracks with optional filtering
- **Database query** (lines 353-359):
  ```sql
  SELECT t.*, f.difficulty, f.genres, f.series_tags, f.era
  FROM tracks_normalized t
  INNER JOIN pool p ON t.track_id = p.track_id
  LEFT JOIN track_facets f ON f.track_id = t.track_id
  WHERE ${whereClause}
  ORDER BY RANDOM()
  LIMIT ?
  ```
- **Supported filters**:
  - `difficulty`: Exact match (lines 333-336)
  - `era`: Exact match (lines 338-341)
  - `series`: Array of series tags, LIKE pattern matching for JSON arrays (lines 343-349)

#### Filter Options Interface (lines 7-11)
```typescript
export interface FilterOptions {
  difficulty?: string
  era?: string
  series?: string[]
}
```

### 3. Database Schema & Query Patterns

**Database Location**: `/workers/migrations/`

#### Track Facets Table (migration 0004)
- File: `/workers/migrations/0004_add_track_facets.sql`
- **Schema**:
  ```sql
  CREATE TABLE track_facets (
    track_id INTEGER PRIMARY KEY,
    difficulty TEXT CHECK(difficulty IN ('easy', 'normal', 'hard')),
    genres TEXT NOT NULL DEFAULT '[]',
    series_tags TEXT NOT NULL DEFAULT '[]',
    era TEXT CHECK(era IN ('80s', '90s', '00s', '10s', '20s')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id) ON DELETE CASCADE
  );
  ```
- **Indexes**: `idx_facets_difficulty`, `idx_facets_era`

#### Filter Support Migration (migration 0006)
- File: `/workers/migrations/0006_add_filter_support.sql`
- Adds `filters_json TEXT DEFAULT '{}'` to `picks` and `exports` tables
- Creates composite indexes: `idx_picks_date_filters`, `idx_exports_date_filters`
- Allows multiple filtered variants per date

#### Pool Table (migration 0001, lines 26-34)
- Tracks availability state: `state TEXT DEFAULT 'available'`
- Used to filter only available tracks in queries

### 4. Existing API Handler Patterns

**Location**: `/workers/api/src/routes/rounds.ts`

#### handleRoundsStart Function (lines 44-99)
- Accepts `GET /v1/rounds/start` request
- Returns JSON response with proper headers
- Pattern for Availability API:
  1. Parse request body
  2. Validate input
  3. Query database
  4. Return JSON response with CORS headers

#### handleRoundsNext Function (lines 104-287)
- Accepts `POST /v1/rounds/next` with body
- Decodes and validates continuation token
- Pattern to follow for `/v1/availability`

**Response format** (examples from rounds.ts):
```typescript
return new Response(JSON.stringify({...}), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
})
```

### 5. No Manifest Endpoint Yet
- **Status**: Not implemented
- **Location would be**: `/workers/api/src/routes/` (new file `manifest.ts`)
- **Would handle**: GET `/v1/manifest` (per API spec section 3.3)
- **Response structure** (from api-spec.md, lines 87-106):
  ```json
  {
    "schema_version": 2,
    "app": { "name": "VGM Quiz", "revision": "2025-09-19" },
    "features": {...},
    "modes": [{"id": "vgm_v1-ja", "title": "VGM Quiz Vol.1 (JA)", ...}],
    "facets": {
      "era": ["80s","90s","00s","10s","mixed"],
      "difficulty": ["easy","normal","hard","mixed"],
      "series": ["ff","dq","zelda","mario","mixed"]
    }
  }
  ```

## Implementation Strategy for Issue #28

### Step 1: Create Availability Query Function
- In `/workers/api/src/lib/daily.ts` or new `/workers/api/src/lib/availability.ts`
- Build WHERE clause similar to `selectTracks()` from publish.ts
- Count total matches instead of selecting them
- Accept `FilterOptions` interface

### Step 2: Create Availability Handler
- File: `/workers/api/src/routes/availability.ts`
- Export: `export async function handleAvailabilityRequest(request: Request, env: Env): Promise<Response>`
- Parse body to extract `mode` and `filters`
- Call availability query function
- Return `{ "available": <count> }` JSON

### Step 3: Wire Up in Main Router
- File: `/workers/api/src/index.ts`
- Add route check (line ~45):
  ```typescript
  if (url.pathname === '/v1/availability' && request.method === 'POST') {
    return await handleAvailabilityRequest(request, env)
  }
  ```

### Step 4: Database Query Pattern
Reference the query from publish.ts lines 353-359:
- Join `tracks_normalized` with `pool` and `track_facets`
- Filter by `pool.state = 'available'`
- Apply difficulty, era, series filters
- Use COUNT(*) instead of SELECT and LIMIT

## Files to Reference When Implementing

1. **API entry point**: `/workers/api/src/index.ts` (entire file)
2. **Rounds handler pattern**: `/workers/api/src/routes/rounds.ts` (entire file)
3. **Filter implementation**: `/workers/pipeline/src/stages/publish.ts` lines 58-369
4. **Filter options**: `/workers/pipeline/src/stages/publish.ts` lines 7-11
5. **API spec**: `/docs/api/api-spec.md` lines 130-141
6. **Database schema**: `/workers/migrations/0004_add_track_facets.sql` and `/workers/migrations/0006_add_filter_support.sql`
7. **Token library**: `/workers/api/src/lib/token.ts` (for understanding request patterns)

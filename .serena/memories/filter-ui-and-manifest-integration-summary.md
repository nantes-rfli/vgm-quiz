# Filter Selection UI & Manifest Integration - Architecture Summary

## Project Context
- **Application**: VGM Quiz (Video Game Music Quiz)
- **Phase**: FE-02 (Filter-aware quiz selection UI with Manifest caching)
- **Status**: Implemented and integrated
- **Date Explored**: 2025-11-11

---

## 1. File Structure Overview

### Core Files
```
web/src/
├── lib/
│   └── filter-context.tsx                    # Filter state management (React Context)
├── components/
│   └── FilterSelector.tsx                    # Main filter UI component
├── features/quiz/
│   ├── api/
│   │   ├── manifest.ts                       # Manifest fetching + caching logic
│   │   └── types.ts                          # API type definitions
│   └── datasource.ts                         # API request construction

web/app/
└── play/
    └── page.tsx                              # Play page (integrates filters)
```

---

## 2. Filter State Management

### FilterContext (`web/src/lib/filter-context.tsx`)

**State Interface:**
```typescript
export interface FilterState {
  difficulty?: Difficulty                     // 'easy' | 'normal' | 'hard' | 'mixed'
  era?: Era                                   // '80s' | '90s' | '00s' | '10s' | '20s' | 'mixed'
  series: string[]                            // e.g., ['ff', 'dq', 'zelda', ...]
}
```

**Default Values:**
```typescript
const defaultFilters: FilterState = {
  difficulty: 'mixed',
  era: 'mixed',
  series: [],
}
```

**Context API:**
- `setDifficulty(difficulty?: Difficulty)` - Set difficulty filter (defaults to 'mixed')
- `setEra(era?: Era)` - Set era filter (defaults to 'mixed')
- `setSeries(series: string[])` - Set series filters (array of strings, filters out 'mixed')
- `reset()` - Reset all filters to defaults
- `isDefault()` - Returns true if filters match default state

**Implementation:**
- Uses React's `useState` hook for state management
- Provides `useFilter()` hook for child components to access filters
- Thrown error if hook used outside FilterProvider context
- All setters normalize 'mixed' values (convert undefined/empty to 'mixed')

---

## 3. Manifest Integration

### Manifest API Types (`web/src/features/quiz/api/manifest.ts`)

**Manifest Structure:**
```typescript
export interface Manifest {
  schema_version: number                      // e.g., 2
  modes: Mode[]                               // Quiz modes (e.g., 'vgm_v1-ja')
  facets: Facets                              // Available filter options
  features: Features                          // Feature flags
}

export interface Facets {
  difficulty: Difficulty[]
  era: Era[]
  series: string[]                            // e.g., ['ff', 'dq', 'zelda', ...]
}
```

### Manifest Caching Strategy

**Storage Configuration:**
- **Key**: `vgm2.manifest.cache` (localStorage)
- **Max Age**: 24 hours (86,400,000 ms)
- **Cache Structure**:
  ```typescript
  interface CachedManifest {
    data: Manifest
    timestamp: number
    version: number                           // schema_version for change detection
  }
  ```

**Fetch Function (`fetchManifest()`):**
1. Makes GET request to `/v1/manifest`
2. Throws on error to enable React Query retry mechanisms
3. On success, saves to localStorage as CachedManifest with timestamp
4. Returns parsed Manifest data

**Storage Function (`loadManifestFromStorage()`):**
1. Retrieves from localStorage key `vgm2.manifest.cache`
2. Validates cache age (returns null if > 24 hours old)
3. Handles JSON parse errors gracefully
4. Returns CachedManifest or null

### useManifest Hook Configuration

**React Query Setup:**
```typescript
export function useManifest() {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    
    // Initial data: Use cached data to prevent loading state
    initialData: loadManifestFromStorage()?.data ?? DEFAULT_MANIFEST,
    initialDataUpdatedAt: 0,                  // Mark stale immediately to force refetch
    
    // Timing
    staleTime: 1 hour                         // Cache is fresh for 1 hour
    gcTime: 24 hours                          // Keep in memory for 24 hours
    
    // Refetch strategy
    refetchOnMount: true                      // Always validate on mount
    refetchOnWindowFocus: false                // Don't refetch on window focus
    refetchInterval: 5 minutes                 // Auto-refetch every 5 mins (catches schema updates)
    refetchOnReconnect: true                   // Sync when network comes back
    
    // Error handling
    throwOnError: false                        // Let React Query handle errors
    select: (data) => data ?? DEFAULT_MANIFEST // Always return Manifest (never undefined)
  })
}
```

**Caching Strategy Summary:**
1. **Mount**: Load from localStorage to avoid loading state
2. **Immediate Refetch**: Trigger fetch because `initialDataUpdatedAt: 0`
3. **Periodic Refresh**: Refetch every 5 minutes to catch manifest changes
4. **Network Recovery**: Refetch when network comes back online
5. **Fallback**: If all sources fail, use DEFAULT_MANIFEST

**Default Manifest Fallback:**
```typescript
const DEFAULT_MANIFEST: Manifest = {
  schema_version: 2,
  modes: [{ id: 'vgm_v1-ja', title: 'VGM Quiz Vol.1 (JA)', defaultTotal: 10 }],
  facets: {
    difficulty: ['easy', 'normal', 'hard', 'mixed'],
    era: ['80s', '90s', '00s', '10s', '20s', 'mixed'],
    series: ['ff', 'dq', 'zelda', 'mario', 'sonic', 'pokemon', 'mixed'],
  },
  features: {
    inlinePlaybackDefault: false,
    imageProxyEnabled: false,
  },
}
```

---

## 4. FilterSelector Component

### Component Location & Props
- **Path**: `web/src/components/FilterSelector.tsx`
- **Type**: Client component (`'use client'`)
- **Provider**: Wrapped in `<FilterProvider>` in play page

**Props:**
```typescript
export interface FilterSelectorProps {
  onStart: (params: Partial<RoundStartRequest>) => void
  disabled?: boolean
}
```

### Key Features

**1. Manifest Loading & Validation:**
- Uses `useManifest()` to fetch manifest
- Renders loading state while manifest not available
- Filters invalid options (removes 'mixed' from radio/checkbox options)

**2. Auto-Reset Invalid Filters:**
- `useEffect` watches manifest + filter changes
- If selected difficulty/era not in manifest → resets to 'mixed'
- If selected series not in manifest → removes from array
- Prevents UI from showing unselected radios due to missing manifest options

**3. Filter Selection UI:**
- **Difficulty**: Radio buttons (single select) - 'mixed' + manifest options
- **Era**: Radio buttons (single select) - 'mixed' + manifest options
- **Series**: Checkboxes (multi-select) - 'all' + manifest options
- **Reset Button**: Disabled if filters are already default
- **Start Button**: Triggers quiz with selected filters

**4. Validation Before Start:**
- Safety check: manifest availability
- Re-validates filter values against current manifest (guards against stale cache)
- Only includes non-default, valid filter values in request
- Filters out series that are no longer in manifest

### Render Flow
1. If manifest loading → show loading state
2. If filters invalid → auto-correct silently
3. Otherwise → render full filter UI with options from manifest

---

## 5. API Request Construction

### /v1/rounds/start Request Format

**Location**: `web/src/features/quiz/datasource.ts`

**Function**: `start(params: Partial<RoundStartRequest> = {})`

**Request Body Structure:**
```typescript
POST /v1/rounds/start
{
  "mode": string | undefined,                 // Optional, defaults to first mode in manifest
  "total": number | undefined,                // Optional, defaults to mode.defaultTotal
  "seed": string | undefined,                 // For deterministic shuffling
  "filters": {
    "difficulty": string[] | undefined,       // ['easy'] or undefined
    "era": string[] | undefined,              // ['90s'] or undefined
    "series": string[] | undefined,           // ['ff', 'dq'] or undefined
  } | undefined
}
```

**Example Requests:**
```javascript
// No filters (default daily quiz)
{
  "mode": undefined,
  "total": undefined,
  "seed": undefined,
  "filters": undefined
}

// With difficulty + era
{
  "filters": {
    "difficulty": ["hard"],
    "era": ["90s"],
    "series": undefined
  }
}

// With multiple series
{
  "filters": {
    "difficulty": undefined,
    "era": undefined,
    "series": ["ff", "dq", "zelda"]
  }
}

// All filters combined
{
  "filters": {
    "difficulty": ["normal"],
    "era": ["00s"],
    "series": ["pokemon", "zelda"]
  }
}
```

**Filter Normalization Logic:**
```typescript
const filtersPresent = params.difficulty || params.era || (params.series?.length > 0)
const body = {
  // ... mode, total, seed ...
  filters: filtersPresent
    ? {
        difficulty: params.difficulty ? [params.difficulty] : undefined,
        era: params.era ? [params.era] : undefined,
        series: params.series?.length > 0 ? [...params.series] : undefined,
      }
    : undefined
}
```

**Key Points:**
- Single difficulty/era converted to single-element arrays
- Series already an array, spread-copied as-is
- If NO filters selected → entire `filters` object set to `undefined`
- API receives arrays (even for single-select) for consistency

---

## 6. Play Page Integration

### File: `web/app/play/page.tsx`

**Flow:**
```typescript
1. Play page renders <FilterProvider> wrapper
   └─> <PlayPageContent/> inside

2. FilterProvider provides useFilter() context
   └─> FilterSelector component consumes it

3. User selects filters → handleStart()
   └─> Validates against manifest
   └─> Calls onStart(params)

4. onStart → onFilterStart callback
   └─> Dispatches 'BOOTING' action
   └─> Calls bootAndStart(params)

5. bootAndStart() calls start(params)
   └─> Constructs POST /v1/rounds/start with filters
   └─> Returns Phase1StartResponse
   └─> Dispatches 'STARTED' with first question
```

**Key Integration Points:**

**FilterProvider Wrapper:**
```tsx
export default function PlayPage() {
  return (
    <FilterProvider>
      <PlayPageContent />
    </FilterProvider>
  )
}
```

**UI Rendering Logic:**
```tsx
{!s.started ? (
  !AUTO_START ? (
    // User selects filters before starting
    <FilterSelector onStart={onFilterStart} disabled={s.loading} />
  ) : (
    // Auto-start mode: show simple "Start" button
    <div>...</div>
  )
) : (
  // Quiz in progress: show questions
  <>...</>
)}
```

**Filter Callback:**
```typescript
const onFilterStart = React.useCallback(
  (params: Partial<RoundStartRequest>) => {
    closeToast()
    safeDispatch({ type: 'BOOTING' })
    void bootAndStart(params)
  },
  [bootAndStart, closeToast, safeDispatch],
)
```

**Bootstrap Function:**
```typescript
const bootAndStart = React.useCallback(
  async (params?: Partial<RoundStartRequest>) => {
    // 1. Wait for MSW to be ready
    await waitMockReady({ timeoutMs: 2000 })
    
    // 2. Call datasource.start(params)
    let res: Phase1StartResponse
    try {
      res = await start(params)  // ← Filters passed here!
    } catch (e) {
      // Retry logic...
    }
    
    // 3. Dispatch STARTED with first question
    safeDispatch({
      type: 'STARTED',
      payload: {
        token: res.continuationToken,
        question: ...,
        progress: res.progress || { index: 1, total: 10 },
        beganAt: performance.now(),
        startedAt: new Date().toISOString(),
      },
    })
  },
  [safeDispatch, closeToast, scheduleRetry],
)
```

---

## 7. localStorage Keys Summary

| Key | Storage Type | Purpose | Notes |
|-----|--------------|---------|-------|
| `vgm2.manifest.cache` | localStorage | Cached Manifest + timestamp | 24-hour TTL, tracks schema_version |
| `vgm2.result.summary` | sessionStorage | Round completion data | (Unrelated to filters) |
| `vgm2.result.reveals` | sessionStorage | Per-question reveal history | (Unrelated to filters) |
| `vgm2.settings.inlinePlayback` | localStorage | Inline playback toggle | (Unrelated to filters) |
| `vgm2.metrics.queue` | localStorage | Unsent metrics events | (Unrelated to filters) |
| `vgm2.metrics.clientId` | localStorage | Anonymous client ID | (Unrelated to filters) |

---

## 8. State Management Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Query                               │
│                    useManifest() hook                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Fetch: /v1/manifest                                   │  │
│  │ - Cache: localStorage[vgm2.manifest.cache]             │  │
│  │ - Refetch: 5min interval, on reconnect, on mount       │  │
│  │ - Fallback: DEFAULT_MANIFEST                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    React Context                                │
│              FilterProvider (filter-context.tsx)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ State:                                                   │  │
│  │ - difficulty: Difficulty                               │  │
│  │ - era: Era                                              │  │
│  │ - series: string[]                                      │  │
│  │                                                         │  │
│  │ Actions:                                                │  │
│  │ - setDifficulty()  - setEra()  - setSeries()           │  │
│  │ - reset()  - isDefault()                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    UI Components                                │
│               FilterSelector.tsx (renders UI)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Reads manifest facets (validates options)             │  │
│  │ - Reads/writes filter state via useFilter()             │  │
│  │ - Auto-resets invalid filters when manifest changes     │  │
│  │ - Validates filters before calling onStart()            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API Integration                              │
│              datasource.ts (start function)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Receives: Partial<RoundStartRequest>                  │  │
│  │ - Constructs request body with filters array format     │  │
│  │ - POST /v1/rounds/start                                 │  │
│  │ - Returns: Phase1StartResponse                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Key Design Patterns

### 1. **Cache-First Strategy**
- Load cached manifest immediately (no loading state)
- Refetch immediately to validate (initialDataUpdatedAt: 0)
- Updates happen in background
- Periodic refresh every 5 minutes catches schema changes

### 2. **Validation at Multiple Layers**
- **Manifest loading**: useManifest auto-selects from cache/API/fallback
- **Filter context**: setters normalize 'mixed' values
- **FilterSelector**: useEffect auto-resets invalid filters
- **API call**: Re-validates filter values against current manifest before request

### 3. **Deterministic Filter Normalization**
- Single-select filters (difficulty, era) normalized to arrays in request body
- Multi-select filters (series) already arrays, copied as-is
- Empty filters object omitted entirely (undefined)

### 4. **Error Recovery**
- Network errors use exponential backoff retry (datasource.ts)
- Offline detection with retry-on-reconnect
- Toast notifications with manual retry action
- All sources fail → falls back to DEFAULT_MANIFEST

---

## 10. Related Type Definitions

**From api/types.ts:**
```typescript
export interface Phase1StartResponse {
  question: Phase1Question
  choices: Phase1Choice[]
  continuationToken: string
  progress?: { index: number; total: number }
  round?: { id: string; mode: string; date: string; filters?: Record<string, unknown> }
}
```

**From api/manifest.ts:**
```typescript
export interface RoundStartRequest {
  mode?: string
  difficulty?: Difficulty
  era?: Era
  series?: string[]
  total?: number
  seed?: string
}

export interface RoundStartParams {
  difficulty?: string
  era?: string
  series?: string | string[]
  total?: string
  seed?: string
}
```

---

## 11. Testing & Mocking

### MSW Mock Handlers
- Located: `web/mocks/handlers.ts`
- Intercepts GET `/v1/manifest` and POST `/v1/rounds/start`
- Uses JWS-like tokens to track round progress
- MSW boots before React Query to properly intercept fetch calls

### Test Data
- Fixtures in: `web/mocks/fixtures/rounds/`
- 10 questions with metadata
- Set `NEXT_PUBLIC_API_MOCK=0` to use real backend (not default)

---

## 12. Future Considerations

### Phase 2+
- Manifest endpoint currently returns fixed default
- Filter options will expand as curated data grows
- Schema versioning allows safe manifest updates
- Series filters may include game franchises (FF, DQ, etc.)

### Performance
- 5-minute refetch interval may be adjusted based on update frequency
- Cache invalidation only on schema_version change
- Could implement incremental manifest updates (schema v3+)

---

## Summary

The filter UI implementation follows a **cache-first, validation-heavy** approach:

1. **Manifest**: Cached in localStorage with 24-hour TTL, refetches every 5 min
2. **Filters**: Stored in React Context, auto-validates against manifest
3. **UI**: FilterSelector renders facet options from manifest, auto-resets invalid filters
4. **API**: Filters sent as arrays in `/v1/rounds/start` POST body
5. **Persistence**: None (filters reset on page reload)
6. **Fallback**: DEFAULT_MANIFEST if all sources fail

This ensures UI always shows valid options and prevents invalid filter requests to backend.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VGM Quiz is a game music quiz application built with Next.js App Router. The monorepo contains:
- `web/` — Next.js frontend (React 19, TypeScript 5, Tailwind v4)
- `workers/` — Cloudflare Workers backend (D1 database, R2 storage)
- `docs/` — Product requirements, design specs, and operational documentation

Phase 1 (MVP) uses Cloudflare Workers for backend with manual curated data. Set `NEXT_PUBLIC_API_MOCK=0` to connect to real backend (default is MSW mocks).

## Development Commands

All commands run from the `web/` directory:

```bash
npm run dev                    # Start dev server (http://localhost:3000)
npm run build && npm run start # Verify production build
npm run lint                   # ESLint checks
npm run typecheck              # TypeScript type checking (noEmit)
npm run validate:fixtures      # Validate JSON fixtures against schemas
npm run test:e2e               # Run Playwright E2E tests (Chromium)
npm run test:e2e:ui            # E2E tests in UI mode for debugging
npm run test:unit              # Run Vitest unit tests
npm run test:a11y              # Run accessibility tests only
```

First-time setup: `cd web && npm install`. If using Playwright for the first time, run `npx playwright install`.

Workers backend commands (from `workers/` directory):

```bash
npm run dev:api                # Start API Worker locally (http://localhost:8787)
npm run dev:pipeline           # Start Pipeline Worker locally (http://localhost:8788)
npm run deploy:api             # Deploy API Worker to production
npm run deploy:pipeline        # Deploy Pipeline Worker to production
npm run typecheck              # TypeScript type checking
npm run lint                   # Biome lint checks
npm run validate:curated       # Validate curated data file (curated.json)
wrangler d1 migrations apply vgm-quiz-db --remote  # Apply DB migrations to production
```

First-time backend setup: `cd workers && npm install`. See [docs/backend/setup.md](docs/backend/setup.md) for D1/R2 configuration.

## Architecture

### Backend (Cloudflare Workers)

**Phase 2 (Current)**: Dynamic sampling with filters + Manifest-driven UI

**Pipeline Worker** (`vgm-quiz-pipeline.nantos.workers.dev`)
- **Discovery stage**: Ingests tracks from [workers/data/curated.json](workers/data/curated.json) into D1 (`tracks_normalized` table)
  - Supports facet metadata: `difficulty`, `genres`, `seriesTags`, `era`
- **Publish stage**: Generates daily question sets **per filter combination** and exports to R2
  - R2 keys: `exports/{date}.json` (default) or `exports/{date}_{filterHash}.json` (filtered)
  - D1 `picks` table stores JSON as backup
- Manual trigger via POST endpoints (`/trigger/discovery`, `/trigger/publish?date=YYYY-MM-DD`)

**API Worker** (`vgm-quiz-api.nantos.workers.dev`)
- `GET /v1/manifest` - Fetch UI metadata (modes, facets, features, schema_version)
- `POST /v1/rounds/start` - Start quiz with optional filters, returns first question + JWS token
  - Filters: `difficulty` (single), `era` (single), `series` (multiple)
  - Manifest-driven validation: filters must be in `facets`
- `POST /v1/rounds/next` - Submit answer via token, get next question or finish
- `POST /v1/metrics` - Telemetry ingest
- Token-based state management (no server-side sessions)
  - Token payload includes `filtersKey` (normalized JSON) + `filtersHash` for R2 lookup

**Database (D1)**
- `sources` - Track data sources
- `tracks_normalized` - Master track catalog with external_id (UPSERT key)
- `pool` - Tracks eligible for question generation
- `picks` - Daily selected track IDs
- `exports` - Generated question set metadata (date, hash, R2 key)

**Storage (R2)**
- `exports/YYYY-MM-DD.json` - Daily question sets with SHA-256 integrity hash
- Single source of truth for frontend consumption

**Key Implementation Details**
- **Choice generation** ([workers/shared/lib/choices.ts](workers/shared/lib/choices.ts)): Requires minimum 4 unique game titles. Shuffles choices deterministically per questionId, then assigns IDs ('a'-'d') to prevent always having 'a' as correct answer.
- **Hash integrity**: Export hash computed from content excluding hash field itself to avoid circular dependency.
- **Deterministic shuffling**: Uses seeded random based on questionId for consistent choice ordering.
- **Metadata schema** ([workers/shared/types/track.ts](workers/shared/types/track.ts)): Phase 2A adds optional facet fields:
  - `difficulty`: Recognition difficulty (easy/normal/hard)
  - `genres`: Genre tags (e.g., ["rpg", "jrpg", "platformer"])
  - `seriesTags`: Series abbreviations (e.g., ["ff", "zelda", "mario"])
  - `era`: Decade classification (80s-20s)

**Phase 2 Status** (Filter-Aware Quiz):
- Phase 2A: ✅ Data model extended with `difficulty`, `era`, `seriesTags` facets
- Phase 2B: ✅ Dynamic sampling + JWS token with `filtersKey` + `filtersHash` (custom hash function, 8-char hex)
- Phase 2C: ✅ Filter UI + Manifest caching + Documentation (current phase)
- Phase 2D: 🔧 schema_version change detection, Availability API display (planned)

**Future Phases** (not yet implemented):
- Phase 3: Spotify API automation for Discovery/Harvest
- Phase 4: YouTube integration, audio download, ML quality scoring
- Phase 5+: Behavioral scoring, automatic scheduling with Cron Triggers



### State Management (Phase 2 Implementation)
- **Filter State** ([web/src/lib/filter-context.tsx](web/src/lib/filter-context.tsx)): React Context + useState for user-selected filters
  - `useFilter()` hook returns: `{ filters, setDifficulty, setEra, setSeries, reset, isDefault }`
  - Difficulty & Era: single-select (string)
  - Series: multi-select (string[])
  - Note: Backend handles normalization (dedup, sort); frontend filters out 'mixed' via setSeries()
  - Managed via `FilterProvider` + hook pattern
- **Manifest State** ([web/src/features/quiz/api/manifest.ts](web/src/features/quiz/api/manifest.ts)): React Query with localStorage caching
  - Cache strategy: localStorage 24h TTL + 5min background refetch (via React Query config)
  - **Fallback**: `DEFAULT_MANIFEST` if both cache and network fail
  - **Phase 2D-Future**: `schema_version` change detection for auto-reset (Issue #115)
  - Structure: `{ data, timestamp, version }` stored in localStorage key `vgm2.manifest.cache`
- **Play page** ([web/app/play/page.tsx](web/app/play/page.tsx)) state machine via `useReducer`
  - Initialized via [playReducer.ts](web/src/features/quiz/playReducer.ts) with filter validation
  - Flow: Filter Selection (FilterSelector) → POST /v1/rounds/start → Question/Reveal loop → Result
  - Timer-based auto-submission after 15 seconds (`QUESTION_TIME_LIMIT_MS = 15000`)
  - Answer submission: POST /v1/rounds/next with token
  - Answer processing: [useAnswerProcessor.ts](web/src/features/quiz/useAnswerProcessor.ts) computes score (correct: 100 + remainingSec×5)

### API Integration (Phase 2)
- **Three main endpoints**:
  - `GET /v1/manifest` — Fetch modes, facets, features, schema_version
    - Used by FilterSelector to populate dropdown options
    - Implemented in API Worker with Manifest endpoint
  - `POST /v1/rounds/start` — Start quiz with filters: `{ mode, difficulty?, era?, series?, total }`
    - Returns: `{ round, question, choices, continuationToken }`
    - Token format: JWS (HMAC-SHA256) with payload including `filtersKey` (JSON string) + `filtersHash` (custom hash function 8-char hex, [workers/shared/lib/filters.ts](../../workers/shared/lib/filters.ts))
    - TTL: **120 seconds** (exp - iat in token payload)
    - Implemented in [workers/src/api/routes/rounds.ts](../../workers/src/api/routes/rounds.ts)
  - `POST /v1/rounds/next` — Submit answer + token, get next question or finished status
    - Body: `{ token: string }`
    - Returns: `{ reveal, question?, choices? }` or `{ finished: true }`
- **Token validation**: Signature (HMAC-SHA256) + expiry check; filtersHash matches filtersKey for integrity
- MSW handlers in [web/mocks/handlers.ts](web/mocks/handlers.ts) mock all endpoints for local development
- See [docs/api/api-spec.md](docs/api/api-spec.md) and [docs/api/rounds-token-spec.md](docs/api/rounds-token-spec.md) for full details
- **Filter validation**: Done on both client (Manifest-based) and server (re-validation)

### Storage Strategy
| Key | Storage | Purpose |
|-----|---------|---------|
| `vgm2.result.summary` | sessionStorage | Round completion data (score, correct/wrong/timeout/skip counts) |
| `vgm2.result.reveals` | sessionStorage | Per-question reveal history for Result page |
| `vgm2.settings.inlinePlayback` | localStorage | Inline playback toggle (0/1) |
| `vgm2.metrics.queue` | localStorage | Unsent metrics events buffer |
| `vgm2.metrics.clientId` | localStorage | Anonymous client ID (UUID) |
| `vgm2.manifest.cache` | localStorage | Manifest JSON + timestamp + schema_version (24h TTL) |

### Scoring Logic
- Correct answer: **100 + remainingSeconds × 5** points
- Wrong/timeout/skip: **0 points**
- Implementation in [web/src/lib/scoring.ts](web/src/lib/scoring.ts)
- Displayed via `ScoreBadge` component

### Metrics Client
- Batch-sends events to `/v1/metrics` (see [docs/frontend/metrics-client.md](docs/frontend/metrics-client.md))
- Events: `round_start`, `answer_select`, `answer_submit`, `reveal_view`, etc.
- Retries with exponential backoff on failure
- Implementation in [web/src/lib/metrics/metricsClient.ts](web/src/lib/metrics/metricsClient.ts)

### Testing
- E2E tests in `web/tests/e2e/` using Playwright
- MSW stubs all network calls for deterministic tests
- Accessibility tests use `@axe-core/playwright`
- Unit tests with Vitest for utility functions ([web/src/lib/](web/src/lib/))

## Code Style

**Frontend** (`web/`)
- TypeScript with React 19 functional components
- 2-space indentation, semicolons disabled
- Kebab-case for files/directories (`quiz-results.tsx`)
- PascalCase for React components
- Hooks prefixed with `use`
- Tailwind utilities composed via `class-variance-authority` (cva)
- ESLint config in `eslint.config.mjs`

**Backend** (`workers/`)
- TypeScript with ESNext target
- 2-space indentation, semicolons as needed (Biome default)
- Kebab-case for files/directories (`daily.ts`)
- Single quotes for strings
- Biome for linting/formatting (`biome.json`)
- Path alias: `@/shared/*` maps to `shared/*`

## Important Patterns

### Play Flow State Machine
1. User loads `/play` → auto-starts if `NEXT_PUBLIC_PLAY_AUTOSTART !== '0'`
2. `bootAndStart()` calls `/v1/rounds/start` → dispatches `STARTED` action
3. User selects choice → `SELECT` action
4. User submits (or timer expires) → calls `/v1/rounds/next` → dispatches `ENTER_REVEAL` + `QUEUE_NEXT`
5. User clicks Next → `ADVANCE` action (loads next question) or navigates to `/result` if finished

### Reveal Metadata
- Each question's reveal includes `meta` (composer, game title, links to YouTube/Spotify)
- Stored in `web/mocks/fixtures/rounds/meta.ts`
- Displayed in `RevealCard` component with external links

### Keyboard Shortcuts (Play page)
- `1-9`: Select choice by number
- `↑/↓`: Navigate choices
- `Enter`: Submit answer (question phase) / Next (reveal phase)

## Documentation

Key docs in `docs/`:

**Product & Architecture**
- [docs/product/requirements.md](docs/product/requirements.md) — Product requirements
- [docs/dev/roadmap.md](docs/dev/roadmap.md) — Phase 1-5 roadmap (current: Phase 2C)
- [docs/backend/architecture.md](docs/backend/architecture.md) — Backend system design

**Phase 2 (Filter-Aware Quiz)**
- [docs/api/api-spec.md](docs/api/api-spec.md) — `/v1/manifest`, `/v1/rounds/start/next`, filter validation
- [docs/api/rounds-token-spec.md](docs/api/rounds-token-spec.md) — JWS token (HMAC-SHA256), `filtersHash` (custom hash function)
- [docs/data/model.md](docs/data/model.md) — Manifest, FilterOptions, Round schemas
- [docs/frontend/play-flow.md](docs/frontend/play-flow.md) — Filter selection → Manifest fetch → Quiz flow
- [docs/frontend/state-management.md](docs/frontend/state-management.md) — useFilter(), useManifest(), FilterContext, localStorage caching
- [docs/dev/phase2-checklist.md](docs/dev/phase2-checklist.md) — Phase 2C completion items (Phase 2D-Future marked)

**Other Documentation**
- [docs/frontend/README.md](docs/frontend/README.md) — Frontend overview
- [docs/frontend/metrics-client.md](docs/frontend/metrics-client.md) — Metrics client implementation
- [docs/backend/README.md](docs/backend/README.md) — Backend overview
- [docs/dev/phase1-implementation.md](docs/dev/phase1-implementation.md) — Phase 1 implementation details
- [docs/backend/database.md](docs/backend/database.md) — D1 schema (sources, tracks_normalized, pool, picks, exports)
- [docs/backend/curated-data-format.md](docs/backend/curated-data-format.md) — Curated data format (4+ unique games required)
- [docs/quality/e2e-plan.md](docs/quality/e2e-plan.md) — E2E test plan

**Update Practice**: Docs updated in same PR as code changes (Docs-as-Code). Phase 2C: Documentation synchronized with actual implementation (Issue #118).

## Workflow

This is a solo project. When implementing features or fixes, follow this workflow:

### Branch Strategy
1. Start from latest main: `git checkout main && git pull`
2. Create feature branch with prefix:
   - `feat/` — new features (e.g., `feat/audio-preload`)
   - `fix/` — bug fixes (e.g., `fix/timer-race-condition`)
   - `refactor/` — code refactoring
   - `docs/` — documentation updates
   - `test/` — test additions/fixes
   - `ci/` — CI/CD changes

### Development Flow
1. Check related docs in `docs/` directory
2. Create feature branch: `git checkout -b feat/feature-name`
3. Make code/doc changes (commit freely during development)
4. **Before pushing**, run quality checks:

   Frontend changes (from `web/` directory):
   ```bash
   npm run lint && npm run typecheck && npm run test:e2e
   ```

   Backend changes (from `workers/` directory):
   ```bash
   npm run lint && npm run typecheck
   ```

5. Push branch: `git push -u origin feat/feature-name`
6. Create PR via GitHub UI (or `gh pr create` if using GitHub CLI)
7. Squash merge via GitHub UI
8. Clean up after merge:
   ```bash
   git checkout main
   git pull
   git fetch --prune
   git branch -D feat/feature-name
   ```

### Commit Message Format
Use imperative mood (command form) for commit subjects:
- ✅ `feat: add audio preload`
- ✅ `fix: harden score calculation`
- ✅ `docs: update API spec`
- ❌ `added audio preload`
- ❌ `fixing score calculation`

Individual commits can be casual; final PR title should follow this format (will be squashed).

### PR Requirements
Include in PR description:
- Change summary (what and why)
- Test results (output from lint/typecheck/test commands)
- Updated documentation (if any)
- Screenshots (for UI changes)

## License

MIT License (see `LICENSE`)

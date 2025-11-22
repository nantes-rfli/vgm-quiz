# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VGM Quiz is a game music quiz application built with Next.js App Router. The monorepo contains:
- `web/` — Next.js frontend (React 19, TypeScript 5, Tailwind v4)
- `workers/` — Cloudflare Workers backend (D1 database, R2 storage)
- `docs/` — Product requirements, design specs, and operational documentation
- `automation/` — Quality assurance automation scripts

**Current Phase**: Phase 4A (Autonomous Content Pipeline) — implementing YouTube/Spotify intake with guard/dedup logic and batch promotion workflow. Phases 1-3 are complete. Set `NEXT_PUBLIC_API_MOCK=0` to connect to real backend (default is MSW mocks).

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
npm run contract               # Run contract tests (Playwright + Vitest)
npm run contract:pw            # Run Playwright contract tests only
npm run contract:vitest        # Run Vitest contract tests only
npm run test:lhci              # Run Lighthouse CI performance tests
```

First-time setup:
- Node.js 24 or higher (see `.nvmrc`)
- `cd web && npm install`
- `npx playwright install` for Playwright browsers

Workers backend commands (from `workers/` directory):

```bash
npm run dev:api                       # Start API Worker locally (http://localhost:8787)
npm run dev:pipeline                  # Start Pipeline Worker locally (http://localhost:8788)
npm run deploy:api                    # Deploy API Worker to production
npm run deploy:pipeline               # Deploy Pipeline Worker to production
npm run typecheck                     # TypeScript type checking
npm run lint                          # Biome lint checks
npm run test                          # Run Vitest unit tests
npm run validate:curated              # Validate curated data file (curated.json)
npm run validate:facet-distribution   # Validate facet metadata distribution
npm run observability:test            # Test observability/metrics integration
npm run export:snapshot               # Export R2 snapshot for backup
npm run promote:batch                 # Promote staging batch to production
wrangler d1 migrations apply vgm-quiz-db --remote  # Apply DB migrations to production
```

First-time backend setup: `cd workers && npm install`. See [docs/backend/setup.md](docs/backend/setup.md) for D1/R2 configuration and [docs/ops/runbooks/content-intake.md](docs/ops/runbooks/content-intake.md) for Phase 4A intake setup.

## Architecture

### Backend (Cloudflare Workers)

**Current Phase**: Phase 4A (Autonomous Content Pipeline with YouTube/Spotify intake)

**Pipeline Worker** (`vgm-quiz-pipeline.nantos.workers.dev`)
- **Discovery stage**: Multi-source track ingestion
  - Manual: [workers/data/curated.json](workers/data/curated.json) → D1 (`tracks_normalized`)
  - Automated (Phase 4A): YouTube/Spotify API intake with source catalog
  - Supports facet metadata: `difficulty`, `genres`, `seriesTags`, `era`
- **Harvest stage** (Phase 4A): Fetch metadata from YouTube/Spotify APIs
- **Guard stage** (Phase 4A): Quality validation (duration, LUFS, silence, clipping, metadata completeness)
  - Thresholds defined in `workers/shared/lib/intake.ts`
  - Audio metrics: LUFS (-22 to -10), silence (≤3%), clipping (≤0.1%)
  - Duration: 30s-8m (prod), 10s-12m (staging)
- **Dedup stage** (Phase 4A): Duplicate detection with fuzzy matching
  - ID-based: `youtubeId`, `spotifyId`, `appleId`
  - Composite key: normalized title+game+composer
  - Fuzzy matching: Levenshtein distance (20% threshold) for near-duplicates
  - Implementation: `workers/shared/lib/dedup.ts`
- **Publish stage**: Generates daily question sets **per filter combination** and exports to R2
  - R2 keys: `exports/{date}.json` (default) or `exports/{date}_{filterHash}.json` (filtered)
  - D1 `picks` table stores JSON as backup
  - Batch promotion workflow for staging → production
- Manual trigger via POST endpoints (`/trigger/discovery`, `/trigger/intake`, `/trigger/publish?date=YYYY-MM-DD`)
- Cron Triggers: Daily automated execution (see [docs/backend/cron-triggers-testing.md](docs/backend/cron-triggers-testing.md))

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

**Development Status**:
- Phase 1 (MVP): ✅ Complete — Manual curation + tokenized API + Cron Triggers
- Phase 2 (Filter-Aware Quiz): ✅ Complete — User filters (difficulty/era/series) + dynamic sampling + Manifest API
- Phase 3 (Observability & Guardrails): ✅ Complete — Web Vitals, contract tests, Lighthouse CI, runtime validation, runbooks, backup automation
- Phase 4A (Content Acquisition): 🔧 In Progress — YouTube/Spotify intake with guard/dedup, batch promotion
  - ✅ PoC deployed with Cron Triggers
  - ✅ Guard/dedup hardening complete (Issue #151)
  - ⏸️ Apple Music intake (pending API keys)
- Phase 4B (Adaptive Gameplay): 📋 Planned — Behavior-based difficulty tuning + new modes
- Phase 4C (Social & Sharing): 📋 Planned — Challenge links + OGP optimization

See [docs/dev/roadmap.md](docs/dev/roadmap.md) for detailed phase breakdown and success criteria.

### Workers Directory Structure

The `workers/` directory is organized as a monorepo with shared code:

```
workers/
├── api/                    # API Worker (vgm-quiz-api)
│   ├── src/
│   │   ├── index.ts       # Worker entry point
│   │   ├── routes/        # API route handlers (/v1/*)
│   │   └── lib/           # API-specific utilities
│   └── wrangler.toml      # API Worker config
├── pipeline/              # Pipeline Worker (vgm-quiz-pipeline)
│   ├── src/
│   │   ├── index.ts       # Worker entry point + Cron handler
│   │   └── stages/        # Pipeline stages (discovery, harvest, guard, dedup, publish)
│   └── wrangler.toml      # Pipeline Worker config
├── shared/                # Shared code between workers
│   ├── lib/               # Shared utilities (token, filters, choices, intake, dedup, etc.)
│   ├── types/             # TypeScript type definitions
│   └── data/              # Shared data files
├── scripts/               # Utility scripts (validate, export, promote)
├── migrations/            # D1 database migrations
├── data/                  # Curated data (curated.json)
└── tests/                 # Unit tests for shared code
```

**Key Implementation Files**:
- `shared/lib/token.ts` — JWS token generation/validation (HMAC-SHA256)
- `shared/lib/filters.ts` — Filter normalization and hash calculation
- `shared/lib/choices.ts` — Choice generation with deterministic shuffling
- `shared/lib/intake.ts` — Guard thresholds and quality validation (Phase 4A)
- `shared/lib/dedup.ts` — Duplicate detection with fuzzy matching (Phase 4A)
- `shared/lib/observability.ts` — Metrics emission and Slack alerts (Phase 3)
- `shared/lib/backups.ts` — Backup/restore utilities (Phase 3)

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
- **E2E tests**: `web/tests/e2e/` using Playwright (smoke, feature, durability, accessibility)
- **Contract tests**: Validate API/metrics payloads against schemas (Playwright + Vitest)
  - Enforced in CI via `npm run contract` (see `.github/workflows/quality.yml`)
  - Validates `/v1/rounds/start`, `/v1/rounds/next`, `/v1/metrics` schemas
- **Unit tests**: Vitest for utility functions ([web/src/lib/](web/src/lib/), [workers/shared/lib/](workers/shared/lib/))
- **Lighthouse CI**: Performance smoke tests for key routes (home, play, result)
  - Configured in `web/lighthouserc.json`
  - Runs in CI on PR and nightly
- **MSW mocking**: All network calls stubbed for deterministic tests
- **Accessibility**: `@axe-core/playwright` for WCAG AA compliance
- **CI/CD**: GitHub Actions workflows for quality gates, E2E, accessibility, Lighthouse, data validation

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
- [docs/dev/roadmap.md](docs/dev/roadmap.md) — Phase 1-5 roadmap (current: Phase 4A)
- [docs/backend/architecture.md](docs/backend/architecture.md) — Backend system design
- [docs/backend/project-structure.md](docs/backend/project-structure.md) — Workers codebase organization

**API & Data Model**
- [docs/api/api-spec.md](docs/api/api-spec.md) — `/v1/manifest`, `/v1/rounds/start/next`, filter validation
- [docs/api/rounds-token-spec.md](docs/api/rounds-token-spec.md) — JWS token (HMAC-SHA256), `filtersHash` (custom hash function)
- [docs/api/error-model.md](docs/api/error-model.md) — Error response format and codes
- [docs/api/metrics-endpoint.md](docs/api/metrics-endpoint.md) — Metrics endpoint specification
- [docs/data/model.md](docs/data/model.md) — Manifest, FilterOptions, Round schemas
- [docs/backend/database.md](docs/backend/database.md) — D1 schema (sources, tracks_normalized, pool, picks, exports)
- [docs/backend/curated-data-format.md](docs/backend/curated-data-format.md) — Curated data format (4+ unique games required)

**Frontend**
- [docs/frontend/README.md](docs/frontend/README.md) — Frontend overview
- [docs/frontend/play-flow.md](docs/frontend/play-flow.md) — Filter selection → Manifest fetch → Quiz flow
- [docs/frontend/state-management.md](docs/frontend/state-management.md) — useFilter(), useManifest(), FilterContext, localStorage caching
- [docs/frontend/metrics-client.md](docs/frontend/metrics-client.md) — Metrics client implementation
- [docs/frontend/error-handling.md](docs/frontend/error-handling.md) — Error handling patterns
- [docs/frontend/theme-system.md](docs/frontend/theme-system.md) — Theme system and dark mode

**Pipeline & Content (Phase 4A)**
- [docs/backend/pipeline/00-overview.md](docs/backend/pipeline/00-overview.md) — Pipeline stages overview
- [docs/backend/pipeline/01-discovery.md](docs/backend/pipeline/01-discovery.md) — Discovery stage (curated + intake)
- [docs/backend/pipeline/02-harvest.md](docs/backend/pipeline/02-harvest.md) — Harvest stage (metadata fetch)
- [docs/backend/pipeline/03-guard.md](docs/backend/pipeline/03-guard.md) — Guard stage (quality validation)
- [docs/backend/pipeline/04-dedup.md](docs/backend/pipeline/04-dedup.md) — Dedup stage (duplicate detection)
- [docs/backend/pipeline/06-publish.md](docs/backend/pipeline/06-publish.md) — Publish stage (export generation)
- [docs/data/source-catalog.md](docs/data/source-catalog.md) — Source catalog format for intake

**Quality & Testing (Phase 3)**
- [docs/quality/e2e-plan.md](docs/quality/e2e-plan.md) — E2E test plan
- [docs/quality/e2e-scenarios.md](docs/quality/e2e-scenarios.md) — E2E test scenarios
- [docs/quality/metrics.md](docs/quality/metrics.md) — Quality metrics and targets
- [docs/quality/measurement-plan.md](docs/quality/measurement-plan.md) — Measurement plan
- [docs/quality/a11y-play-result.md](docs/quality/a11y-play-result.md) — Accessibility audit results

**Operations & Runbooks (Phase 3)**
- [docs/ops/observability.md](docs/ops/observability.md) — Observability dashboard and alerts
- [docs/ops/api-security-operations.md](docs/ops/api-security-operations.md) — API security, rate limiting, key rotation
- [docs/ops/frontend-backend-integration.md](docs/ops/frontend-backend-integration.md) — Integration testing and deployment
- [docs/ops/runbooks/content-intake.md](docs/ops/runbooks/content-intake.md) — Content intake operations (Phase 4A)
- [docs/ops/runbooks/audio-playback.md](docs/ops/runbooks/audio-playback.md) — Audio playback troubleshooting
- [docs/ops/runbooks/daily-backup.md](docs/ops/runbooks/daily-backup.md) — Daily backup procedures

**Update Practice**: Docs updated in same PR as code changes (Docs-as-Code). Documentation is synchronized with implementation and reviewed as part of the PR process.

## CI/CD Pipeline

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **quality.yml** | PR, push to main | Lint, typecheck, build, fixtures validation, contract tests |
| **e2e-smoke.yml** | PR | Quick E2E smoke tests (critical paths) |
| **e2e-feature.yml** | PR | Full E2E feature tests |
| **e2e-durability.yml** | PR | Long-running durability tests |
| **e2e-smoke-nightly.yml** | Daily (cron) | Nightly smoke tests against production |
| **a11y-smoke.yml** | PR | Accessibility tests with axe-core |
| **lighthouse.yml** | PR, push to main | Lighthouse performance audits |
| **validate-data.yml** | PR (on data changes) | Validate curated.json and facet distribution |

**Quality Gates** (must pass for merge):
- ✅ ESLint + TypeScript typecheck (zero errors)
- ✅ Build succeeds (Next.js production build)
- ✅ Contract tests pass (API/metrics schema validation)
- ✅ E2E smoke tests pass (critical user flows)
- ✅ Lighthouse performance meets thresholds
- ✅ Accessibility audit passes (WCAG AA)

**Caching Strategy**:
- npm dependencies cached by `setup-node` action
- Playwright browsers cached automatically
- Build artifacts uploaded on failure for debugging

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
   npm run lint && npm run typecheck && npm run test:e2e && npm run contract
   ```

   Backend changes (from `workers/` directory):
   ```bash
   npm run lint && npm run typecheck && npm run test
   ```

   Data changes (curated.json or source catalog):
   ```bash
   npm run validate:curated && npm run validate:facet-distribution  # from workers/
   ```

5. Push branch: `git push -u origin feat/feature-name`
6. Create PR via GitHub UI (or `gh pr create` if using GitHub CLI)
   - CI will run quality gates, E2E, contract, and Lighthouse tests
   - All checks must pass before merge
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

## Phase 4A Specific Patterns

### Content Intake Pipeline
The intake pipeline follows a strict staging → production promotion workflow:

**Staging Flow** (default for development):
1. Set `INTAKE_STAGE=staging` in environment
2. Run intake: `POST /trigger/intake` or via Cron
3. Tracks written to staging tables in D1 with `batch_id`
4. Exports written to R2 with staging prefix
5. Review metrics in observability dashboard

**Production Promotion**:
1. Validate staging batch quality (via observability dashboard)
2. Run promotion script: `npm run promote:batch -- --batch-id=<id>` (from `workers/`)
3. Script copies staging → production tables and R2 exports
4. Rollback available via same script with `--rollback` flag

**Guard/Dedup Configuration**:
- Thresholds defined in `workers/shared/lib/intake.ts` (`GUARD_THRESHOLDS`)
- Staging uses relaxed thresholds to catch edge cases
- Production uses strict thresholds (30s-8m duration, -22 to -10 LUFS, ≤3% silence)
- Missing audio metrics generate WARN logs in staging, ERROR in production

**Retry & Backoff** (Phase 4A hardening):
- API calls (YouTube/Spotify) use exponential backoff: 2s, 4s, 8s (max 3 retries)
- 429 quota errors trigger tier downgrade (L3→L2→L1) or next-day retry
- Network failures are transient and retry automatically
- Non-retriable errors (401, 404) skip retry and log to `intake_guard_fail`

**Observability** (Phase 3 integration):
- All intake events emit structured logs with `intake_*` prefixes
- Metrics sent to Slack via webhook when `OBS_ENABLED=true`
- Dashboard tracks: success rate, duplicate rate, guard failures, API quota usage
- Implementation: `workers/shared/lib/observability.ts`

### Secrets Management
Never commit secrets to Git. Use Wrangler secrets:

```bash
# Set secrets for workers
wrangler secret put YOUTUBE_API_KEY --config workers/api/wrangler.toml
wrangler secret put SPOTIFY_CLIENT_ID --config workers/pipeline/wrangler.toml
wrangler secret put OBS_SLACK_WEBHOOK_URL --config workers/pipeline/wrangler.toml

# Local development: use .dev.vars (gitignored)
# See docs/backend/setup.md for details
```

### Backup & Redundancy
- Daily R2 snapshots retained for 14 days (configurable via `BACKUP_RETENTION_DAYS`)
- Export snapshots: `npm run export:snapshot` (from `workers/`)
- Manual backup creation documented in [docs/ops/runbooks/daily-backup.md](docs/ops/runbooks/daily-backup.md)
- Redundancy ensures 14 days of new rounds even if intake pipeline fails

## MCP Server Integration

This project uses MCP (Model Context Protocol) servers for enhanced capabilities:

- **playwright**: Browser automation for E2E testing and web scraping
- **context7**: Library documentation lookup for dependencies

MCP servers configured in `.mcp.json` and enabled in `.claude/settings.local.json`.

## License

MIT License (see `LICENSE`)

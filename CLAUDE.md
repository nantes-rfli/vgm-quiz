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

**Phase 1 (Current)**: Manual curated data with two-worker architecture

**Pipeline Worker** (`vgm-quiz-pipeline.nantos.workers.dev`)
- **Discovery stage**: Ingests tracks from [workers/data/curated.json](workers/data/curated.json) into D1 (`tracks_normalized` table)
  - Phase 2A: curated.json extended with `difficulty`, `genres`, `seriesTags`, `era` fields for filtering
- **Publish stage**: Generates daily question sets (10 questions, 4-choice format) and exports to R2
- Manual trigger via POST endpoints (`/trigger/discovery`, `/trigger/publish?date=YYYY-MM-DD`)

**API Worker** (`vgm-quiz-api.nantos.workers.dev`)
- `GET /daily?date=YYYY-MM-DD` - Fetch daily question set metadata
- `GET /v1/rounds/start` - Start quiz round, returns first question + continuation token
- `POST /v1/rounds/next` - Submit answer, get next question or finish
- Token-based state management (no server-side sessions)

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

**Future Phases** (not yet implemented):
- Phase 2: Spotify API automation for Discovery/Harvest
- Phase 3: YouTube integration, audio download, ML quality scoring
- Phase 4+: Behavioral scoring, automatic scheduling with Cron Triggers



### State Management
- **Play page** ([web/app/play/page.tsx](web/app/play/page.tsx)) uses `useReducer` with centralized state transitions via [playReducer.ts](web/src/features/quiz/playReducer.ts)
- Two phases: `question` (user answering) and `reveal` (showing result + metadata)
- Timer-based auto-submission after 15 seconds (`QUESTION_TIME_LIMIT_MS`)
- Answer processing extracted into [useAnswerProcessor.ts](web/src/features/quiz/useAnswerProcessor.ts) hook

### API Integration
- **Two endpoints only**: `/v1/rounds/*` (quiz flow) and `/v1/metrics` (telemetry)
- MSW handlers in [web/mocks/handlers.ts](web/mocks/handlers.ts) use JWS-like tokens to track round progress
- Fixtures in `web/mocks/fixtures/rounds/` define 10 questions with metadata
- Set `NEXT_PUBLIC_API_MOCK=0` to disable MSW and connect to real backend (not yet implemented)

### Storage Strategy
| Key | Storage | Purpose |
|-----|---------|---------|
| `vgm2.result.summary` | sessionStorage | Round completion data (score, correct/wrong/timeout/skip counts) |
| `vgm2.result.reveals` | sessionStorage | Per-question reveal history for Result page |
| `vgm2.settings.inlinePlayback` | localStorage | Inline playback toggle (0/1) |
| `vgm2.metrics.queue` | localStorage | Unsent metrics events buffer |
| `vgm2.metrics.clientId` | localStorage | Anonymous client ID (UUID) |

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
- [docs/product/requirements.md](docs/product/requirements.md) — Product requirements
- [docs/api/api-spec.md](docs/api/api-spec.md) — API specification
- [docs/data/model.md](docs/data/model.md) — Data models
- [docs/frontend/README.md](docs/frontend/README.md) — Frontend overview
- [docs/frontend/play-flow.md](docs/frontend/play-flow.md) — Play page state flow
- [docs/frontend/metrics-client.md](docs/frontend/metrics-client.md) — Metrics implementation
- [docs/backend/README.md](docs/backend/README.md) — Backend overview
- [docs/backend/architecture.md](docs/backend/architecture.md) — Backend architecture
- [docs/dev/phase1-implementation.md](docs/dev/phase1-implementation.md) — Phase 1 implementation
- [docs/backend/database.md](docs/backend/database.md) — Database schema
- [docs/backend/curated-data-format.md](docs/backend/curated-data-format.md) — Curated data format (minimum 4 unique games required)
- [docs/quality/e2e-plan.md](docs/quality/e2e-plan.md) — E2E test plan

Docs are updated in the same PR as code changes (Docs-as-Code). Issue-specific docs live in `docs/issues/<number>-*.md`.

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
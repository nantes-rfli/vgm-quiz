# VGM Quiz Project Overview

## Project Purpose
A game music quiz application where users guess video game music track information. Built as a monorepo with:
- Frontend: Next.js 19 with React 19 and Tailwind v4
- Backend: Cloudflare Workers (two workers: API and Pipeline)
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2
- Data: Manual curated JSON with metadata (difficulty, series, era, genres)

## Phase
Currently in **Phase 2B** (Manifest & API refresh)
- Phase 1 (MVP): Manual curated data, fixed daily questions
- Phase 2B-D: Dynamic sampling with facets (difficulty/era/series), Manifest API, filter UI

## Architecture
- **Pipeline Worker**: Discovery (D1 ingestion) + Publish (sampling & question generation)
- **API Worker**: `/v1/rounds/start`, `/v1/rounds/next` endpoints with token-based state
- **Frontend**: `/play` page with quiz flow, result tracking via sessionStorage/localStorage
- **Data**: `workers/data/curated.json` with track metadata

## Tech Stack
- Frontend: TypeScript, React 19, Tailwind v4, ESLint, Playwright, Vitest
- Backend: TypeScript, Cloudflare Workers, D1, Biome
- Testing: Playwright E2E, Vitest unit tests, MSW mocking

## Code Style
- **Frontend** (`web/`): 2-space indent, no semicolons, kebab-case files, PascalCase components
- **Backend** (`workers/`): 2-space indent, single quotes, kebab-case files, Biome formatting
- Shared types in `workers/shared/types/`
- API integration via MSW mocks (development) or real endpoints (production)

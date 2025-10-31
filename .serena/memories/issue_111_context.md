# Issue #111: BE-05 Dynamic Sampling with Facet-Based Filtering

## Objective
Implement dynamic sampling in the Publish stage of the Pipeline Worker to support filtering by:
- **difficulty**: easy/normal/hard
- **era**: 80s/90s/00s/10s/20s
- **series**: FF, DQ, Zelda, Mario, Sonic, Pokemon, etc.
- **genres**: RPG, JRPG, platformer, etc.

## Current State (Phase 1)
- Publish stage samples from entire pool
- No filtering capability
- Fixed daily questions via R2 export

## Target State (Phase 2B)
- Accept filter parameters (difficulty, era, series)
- Query D1 with facet constraints
- Return error if insufficient tracks
- Maintain cooldown logic (prevent recent repeats)

## Key Files
- `workers/pipeline/src/stages/publish.ts` - Main publish logic (needs update)
- `workers/shared/types/track.ts` - Track metadata schema
- `workers/data/curated.json` - Curated track data with facet fields
- Database: `tracks_normalized` table (main catalog), `pool` table (eligible tracks)

## Prerequisite Issues
- #107: curated.json metadata extension (difficulty, era, genres, seriesTags)
- #108: D1 schema extension with facet columns
- #110: 100+ track data injection

## Success Criteria
- [ ] Publish accepts filter params (difficulty, era, series)
- [ ] Dynamic D1 queries for facet filtering
- [ ] Error handling for insufficient tracks
- [ ] Cooldown logic preserved
- [ ] Type checking passes

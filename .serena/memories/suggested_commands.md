# Common Development Commands

## Frontend (web/ directory)
```bash
npm run dev                    # Start dev server (http://localhost:3000)
npm run build && npm run start # Production build verification
npm run lint                   # ESLint checks
npm run typecheck              # TypeScript checking
npm run test:e2e               # Playwright E2E tests
npm run test:unit              # Vitest unit tests
npm run validate:fixtures      # JSON schema validation
```

## Backend (workers/ directory)
```bash
npm run dev:api                # Start API Worker (http://localhost:8787)
npm run dev:pipeline           # Start Pipeline Worker (http://localhost:8788)
npm run deploy:api             # Deploy API Worker to production
npm run deploy:pipeline        # Deploy Pipeline Worker to production
npm run lint                   # Biome linting
npm run typecheck              # TypeScript checking
npm run validate:curated       # Validate curated.json
npm run validate:facet-distribution  # Validate facet distribution
npm run test                   # Vitest tests
```

## Git & Project
```bash
git checkout -b feat/feature-name   # Create feature branch
git push -u origin feat/feature-name # Push branch
gh pr create                        # Create PR via CLI
```

## Important
- Run full checks before pushing: `npm run lint && npm run typecheck && npm run test:e2e` (frontend) or `npm run lint && npm run typecheck` (backend)
- All commands in web/ run from `web/` directory
- All commands in workers/ run from `workers/` directory
- Environment: Node.js (check .nvmrc for version)

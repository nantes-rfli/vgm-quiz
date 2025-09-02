# Release & Deployment

This project is deployed via **GitHub Pages**. `main` → Pages auto-deploy.

## Fast path (no tag)

1. Open a PR → Merge to `main`
2. **Pages** workflow publishes `/app/`
3. Verify on production:
   - Footer shows `Dataset: vN • commit: abcdefg • updated: YYYY-MM-DD HH:mm`
   - E2E in CI: green
   - (Optional) Lighthouse nightly will re-check

## Formal release (tagged)

> **Tagging policy**
> - We **still support tagged releases** for milestones (e.g., v1.0.2). Use this for stable cutovers you want to pin.
> - Quick fixes / docs-only changes can go via the **Fast path** without tagging.
>
> **How to tag**
> ```bash
> git tag vX.Y.Z
> git push origin vX.Y.Z   # triggers release.yml (tag push)
> # or run Actions → Release → Run workflow with input: tag=vX.Y.Z
> ```

> The repository includes `release.yml` for releases. Triggers may be **tag push** and/or **workflow_dispatch**.
> Check the workflow file if unsure. Typical options:

**A. Tag push**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**B. Manual dispatch**

- Actions → `release.yml` → **Run workflow**

## Pre- and post-release checklist

- [ ] Merge `main` green (CI/E2E passed)
- [ ] If dataset changed, confirm `public/build/version.json` has updated `generated_at`/`commit`
- [ ] Production sanity checks:
  - [ ] `/app/?test=1&autostart=0` loads
  - [ ] Media stubbed under `?test=1` / `?lhci=1`
  - [ ] `window.__rng` is `"function"` and `console.table(window.__questionDebug)` works
- [ ] Create release notes (link to CHANGELOG)


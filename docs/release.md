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


## Versioning model（Roadmap vs Tags）

- **Roadmap v1.x** は「テーマ別のマイルストン番号」です（例: v1.1=“AUTO可視性”）。実装の進行管理のための **内部ラベル** で、SemVer ではありません。
- **Gitタグ vMAJOR.MINOR.PATCH** は **出荷単位（リリース）** を表します。`release.yml` のトリガで配信され、`CHANGELOG.md` に記録します。

運用ルール（最小）:
- **PATCH**（例: `v1.0.2`, `v1.0.3`）… 小刻みな出荷（不具合修正・小改善・軽いFeatureの束）。
- **MINOR**（例: `v1.1.0`）… まとまった機能群や大きめのUI変更を“ひと区切り”として出す時に使用。
- **MAJOR**（例: `v2.0.0`）… 互換性に影響する破壊的変更（URL/paramsの非互換、データ形式刷新 等）。

**対応関係（例）**（1:1 ではありません。1つのタグに複数の Roadmap 項目が含まれることがあります）:

| Roadmap | リリースタグ（例） | 備考 |
|---|---|---|---|
| v1.1 “AUTO可視性” | `v1.0.2` | 軽量E2E/CTA/meta などを束ねて出荷 |
| v1.2 “正規化・エイリアス拡充” | `v1.0.3` | 正規化ケース/aliasesスモーク/Budgets微調整 ほか |

> 既存タグが未発行の場合は、完了後にまとめて `git tag v1.0.x && git push origin v1.0.x` で作成して構いません。


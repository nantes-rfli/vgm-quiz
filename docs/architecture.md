# Architecture (High-Level)

## Data -> App -> Pages
1. **Data Build (Clojure)** → `public/build/dataset.json`
2. **Node Scripts** → `public/app/daily.json`, `public/app/daily_auto.json`, `/public/daily/*.html`
3. **App (GitHub Pages)** → `/public/app/` を配信、`?daily=...` で表示
4. **SW 更新検知** → `public/app/version.json` でハンドシェイク（~60s）

## Pipelines
- **daily.json generator (JST)**: daily.json と /daily HTML を更新
- **daily (auto …)**: daily_auto.json を更新（HTML には触れない）

## E2E / Monitoring
- smoke テスト（/daily + latest / AUTO バッジ）
- Lighthouse Budgets（warn）

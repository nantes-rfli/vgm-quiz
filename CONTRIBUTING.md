# CONTRIBUTING

歓迎します！このリポジトリの開発・運用の入口は **[docs/README.md](docs/README.md)** です。

## 基本方針
- **小さなPR** を積み上げる（既存フローに触れない「追加ファイルのみ」が安全）
- 重要変更は **E2E** と **Docs** を一緒に更新
- 反映確認はフッター右の **Dataset/commit/updated** と `/daily` のシェアページで

## よく使うワークフロー
- `daily.json generator (JST)` : `/public/daily/*.html` も更新されます
- `e2e (daily share & latest smoke)` : `/daily` のJSリダイレクト健全性
- `e2e (auto badge smoke)` : `/app/?daily=...&auto=1` のAUTOバッジ
- `lighthouse (budgets, nightly)` : 軽い品質監視（warn）

## 参考
- CI / Ops バッジ一覧: **[docs/ci-status.md](docs/ci-status.md)**
- Ops Tips: **[docs/ops-tips.md](docs/ops-tips.md)**
- Pipeline: **[docs/pipeline.md](docs/pipeline.md)** / AUTO: **[docs/auto-mode.md](docs/auto-mode.md)**

> PRの説明には、必要に応じて「どのワークフローを走らせ／どのURLで確認したか」を添えてください。

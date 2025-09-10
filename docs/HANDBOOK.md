# VGM Quiz Handbook

本ドキュメントは、**開発 / データパイプライン / 配信 / 運用 / 監視 / QA** を一箇所に集約したハンドブックです。

## 0. 用語（Glossary）
- **daily.json generator (JST)**: Clojure ビルドから `public/build/dataset.json` を発行し、`scripts/*` により `/public/app/daily.json` と `/public/daily/*.html` を生成する定期処理（手動実行可）。
- **daily (auto …)**: `public/app/daily_auto.json` を生成するパイプライン。**HTML は生成しない**。
- **AUTO モード**: `?auto=1`（必要なら `&auto_any=1`）を付与して、`daily_auto.json` の choices をアプリ側に反映。
- **JS リダイレクト**: `/public/daily/*.html` は `meta refresh` ではなく **JS リダイレクト**でアプリへ遷移。`?no-redirect=1` で抑止、`?redirectDelayMs=1500` で遅延。
- **SW ハンドシェイク**: `public/app/version.json` を用いた Service Worker の更新検知（~60 秒ポーリング）。

より詳細は [docs/GLOSSARY.md](GLOSSARY.md) 参照。

## 1. アーキテクチャ概要
- **データ**: Clojure で `public/build/dataset.json` を生成 → Node スクリプトで `daily.json` / `daily_auto.json` / `/public/daily/*.html` を生成。
- **アプリ**: GitHub Pages で `/public/app/` を配信。クエリ `?daily=YYYY-MM-DD` で対象データ表示。`?auto=1` で AUTO 反映。
- **配信**: GitHub Actions（Required → Auto-merge）。フッター右で `Dataset: vN • commit: abcdefg • updated: YYYY-MM-DD HH:mm` を目視確認。

図は略。詳細は [docs/ARCHITECTURE.md](ARCHITECTURE.md)。

## 2. パイプライン（責務の分離）
- **daily.json generator (JST)** = `/public/app/daily.json` **と** `/public/daily/*.html` を生成 / 更新
- **daily (auto …)** = `/public/app/daily_auto.json` の生成 / 更新（**HTML には触れない**）

運用の具体的な流れは [docs/pipeline.md](pipeline.md) と [docs/ops-runbook.md](ops-runbook.md)。

## 3. 運用 Tips（落とし穴）
- GitHub Actions の `outputs` で **ハイフンキー**はブラケット記法：`steps.<id>.outputs['pull-request-url']`
- `if:` は **真偽値**で評価（URL 文字列そのままは不可）
- `Summary` は `run: |` で整形し、`RESOLVED_DATE → inputs.date → JST今日` の順にフォールバック
- PR は **差分が無いと作られない**（正常）
- `/daily/*.html` の JS リダイレクトで `?no-redirect=1` / `?redirectDelayMs=...` が使える

詳細は [docs/ops-tips.md](ops-tips.md)。

## 4. QA / 監視
- **E2E（/daily シェア & latest）**: [docs/e2e-daily-pages-smoke.md](e2e-daily-pages-smoke.md)
- **E2E（AUTO バッジ）**: [docs/e2e-auto-badge-smoke.md](e2e-auto-badge-smoke.md)
- **Lighthouse Budgets**（warn, nightly）: [docs/lighthouse-budgets.md](lighthouse-budgets.md)
- **CI バッジ一覧**: [docs/ci-status.md](ci-status.md)

## 5. リリース・チェックリスト
- PR の説明に **実行したワークフロー**と**確認 URL** を明記
- 必要に応じて `daily.json generator (JST)` を手動実行（/daily の HTML 反映）
- 反映確認：フッター右（Dataset/commit/updated）、`/daily/YYYY-MM-DD.html?no-redirect=1`
- 主要 E2E / Lighthouse の状況を確認（緑）

詳細は [docs/release-checklist.md](release-checklist.md)。

## 6. トラブルシューティング
- YAML の `bad indentation` / `if:` で URL を直接置いてしまう → 修正例あり
- `/daily/*.html` がすぐリダイレクトして検証できない → `?no-redirect=1`
- 当日分のシェアページが 404 → `daily.json generator (JST)` の実行を確認
- AUTO が反映されない → `?auto=1` 付与、曲の正規化一致（検証時は `&auto_any=1`）

詳細は [docs/troubleshooting.md](troubleshooting.md)。

## 7. 参照
- [docs/pipeline.md](pipeline.md)
- [docs/auto-mode.md](auto-mode.md)
- [docs/ops-runbook.md](ops-runbook.md)
- [docs/ops-tips.md](ops-tips.md)
- [docs/GLOSSARY.md](GLOSSARY.md)
- [docs/urls-and-params.md](urls-and-params.md)
- [docs/e2e-daily-pages-smoke.md](e2e-daily-pages-smoke.md)
- [docs/e2e-auto-badge-smoke.md](e2e-auto-badge-smoke.md)
- [docs/lighthouse-budgets.md](lighthouse-budgets.md)
- [docs/ci-status.md](ci-status.md)

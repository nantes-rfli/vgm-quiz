# CI / Ops Status

- **e2e (daily share & latest smoke)**  
  ![e2e (daily share & latest smoke)](https://github.com/nantes-rfli/vgm-quiz/actions/workflows/e2e-daily-pages-smoke.yml/badge.svg?branch=main)

- **e2e (light regressions)**  
  ![e2e (light regressions)](https://github.com/nantes-rfli/vgm-quiz/actions/workflows/e2e-light-regressions.yml/badge.svg?branch=main)

- **lighthouse (budgets, nightly)**  
  ![lighthouse (budgets, nightly)](https://github.com/nantes-rfli/vgm-quiz/actions/workflows/lighthouse-budgets.yml/badge.svg?branch=main)

- **docs enforcer**  
  ![docs-enforcer](https://github.com/nantes-rfli/vgm-quiz/actions/workflows/docs-enforcer.yml/badge.svg?branch=main)

- **roadmap guard (non-blocking)**  
  ![roadmap-guard](https://github.com/nantes-rfli/vgm-quiz/actions/workflows/roadmap-guard.yml/badge.svg?branch=main)

- **daily.json generator (JST)**  
  *(既存ワークフロー名に合わせて必要なら差し替えてください)*

### Required にするチェック（推奨・最小）
- **e2e (light required) / required-check** をブランチプロテクションの **Required** に設定すると、
  Pages の `latest.html` に `meta[name=description]` が常に存在することを PR 時に保証できます。
  （軽量・安定で、他のチェックは非ブロッキングのまま運用可能）

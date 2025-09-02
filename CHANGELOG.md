## Unreleased

- docs: ROADMAP synced with FEATURES (`a11y-hardening`, `difficulty-badge`, `heuristic-media-guard`)
- feat(ui): Start画面に「AUTOを有効にする」を追加（永続化）; バッジに aria-label を付与

# Changelog

All notable changes to this project will be documented in this file.

## 2025-09-02

### Added
- **AUTO ON toast**: `public/app/auto_toast.mjs`（?auto=1 または設定ONで起動時に通知、1セッション1回）
- **AUTO settings (persist)**: Start画面にチェックを追加し `localStorage.quiz-options.auto_enabled` を保持
- **e2e (auto toast)**: `e2e/test_auto_toast.mjs` ＋ `.github/workflows/e2e-auto-toast.yml` を追加

### Added
- **e2e (light regressions)**: 
  - `e2e/test_keyboard_flow_smoke.mjs`（Tab→Enter で回答できるかの最小回帰）
  - `e2e/test_share_cta_visibility.mjs`（`/daily/*.html?no-redirect=1` / `latest.html` のCTA/導線確認）
  - `.github/workflows/e2e-light-regressions.yml`（手動＋Nightly JST 04:25）
- **roadmap guard (non-blocking)**:
  - `scripts/roadmap-guard.mjs` ＋ `.github/workflows/roadmap-guard.yml`
  - `docs/FEATURES.yml` の planned が `docs/ROADMAP.md` に無い場合にPRへ**警告コメント**を付与（非ブロッキング）
- **docs-enforcer**: コード変更のPRで `README` / `docs/**` / `FEATURES.*` / `ROADMAP` / `CHANGELOG` の**いずれか**が更新されていないと fail（`docs:skip`で除外可）

### Changed
- **README / docs** を現状仕様に同期:
  - Share page は **JS リダイレクト**（`?no-redirect=1` / `redirectDelayMs` の抑止/遅延パラメータを明記）
  - `docs/params.md` を新設し、クエリパラメータを網羅（`seed`, `qp`, `lives`, `lhci`, `nomedia` など）
  - `docs/ci.md`, `docs/ci-status.md` を更新（新規ワークフロー・バッジ・Nightly時刻を追記）
  - `docs/e2e-light-regressions.md` を新設（Keyboard/Shareの軽量回帰を解説）
  - `docs/ops.md` を強化（JSリダイレクトのデバッグ、落とし穴、トラブルシューティング）
  - `docs/labels.md` を新設（`docs:skip`, `roadmap:v1.x`, `ops:low/high-risk`）
- **ROADMAP.md**: v1.4 を **a11yのハードニング**として明確化。冒頭に「正本は FEATURES.yml／Roadmapは背景の物語」を追記

### Fixed
- **latest.html テストの厳しさ**を調整：相対リンクやアンカーテキストでの当日誘導もOKに（`e2e/test_share_cta_visibility.mjs`）

---

## 既存のタグ
- v1.0.1 以前：初期実装（MCQ/自由入力、正規化v1.2、SW更新、Daily/RSS、AUTO、A11yベースライン 等）

## v1.0.2 — 2025-09-02

- v1.1(AUTO可視性) deliverables shipped（AUTOトースト/設定UI/バッジA11y/latest CTA & meta/E2E）

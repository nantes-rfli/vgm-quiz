# e2e (light regressions)

**目的**: 壊れやすい導線を**高速・最小コスト**で見張る。Playwrightを使うのはKeyboardのみ、ShareはfetchでHTML検査。

## ケース

### 1) Keyboard flow smoke
- **ファイル**: `e2e/test_keyboard_flow_smoke.mjs`
- **内容**: `Tab`で選択肢にフォーカス→`Enter`で解答確定できるかを確認。
- **起動例**:
  ```bash
  APP_URL="https://nantes-rfli.github.io/vgm-quiz/app/" DATE="2025-09-01" node e2e/test_keyboard_flow_smoke.mjs
  ```
- **アーティファクト**: 失敗時 `kb_flow_failure.html` / `kb_flow_failure.png`

### 2) Share CTA visibility
- **ファイル**: `e2e/test_share_cta_visibility.mjs`
- **内容**: `/daily/YYYY-MM-DD.html?no-redirect=1` と `latest.html?no-redirect=1` に、CTAまたは当日ページへの明示的リンクがあるかを検査。
- **起動例**:
  ```bash
  SHARE_BASE="https://nantes-rfli.github.io/vgm-quiz/daily/" DATE="2025-09-01" node e2e/test_share_cta_visibility.mjs
  ```
- **許容パターン（latest.html）**:
  - `/daily/YYYY-MM-DD.html` への絶対リンク
  - `href="./YYYY-MM-DD.html"` の相対リンク
  - アンカーテキスト `>YYYY-MM-DD<`
  - `location.href` による遷移文字列
- **アーティファクト**: 失敗時 `share_cta_failure.html` / `share_cta_latest_failure.html`

## ワークフロー

- **ファイル**: `.github/workflows/e2e-light-regressions.yml`
- **手動実行**: `Actions → e2e (light regressions) → Run workflow`
  - `date`: 生成済みの安全な日付（例: `2025-09-01`）を入れると安定
  - `app_url` / `share_base`: 既定で本番URL
- **スケジュール**: JST 04:25（UTC 19:25）

## トラブル時の指針
- **Keyboardが落ちる**: フォーカス移動のヒューリスティックに依存。`findChoiceViaTab()`の条件を微調整（`role="button"` / `.class` / `data-*` を1行追加など）。
- **Shareが落ちる**: その日の `/daily/*.html` 未生成 or latest実装が変更された可能性。`?no-redirect=1` でHTMLを目視、テスト側の許容パターンを増やす。

## 関連
- `docs/ci.md` – CI全体像
- `docs/ops-runbook.md` – 運用フロー
- `docs/urls-and-params.md`（正本） – URL/クエリ仕様
- **AUTO badge a11y (static)** — `public/app/auto_badge.mjs` 内に a11y 属性（`role` / `aria-live` / `aria-label`）が含まれることをチェック。

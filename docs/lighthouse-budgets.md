# lighthouse (budgets, nightly)

- 目的: **退行の早期検知**（ただし誤検知を避けるため、しきい値は緩め / `warn`）
- 対象URL:
  - `/app/`
  - `/daily/latest.html?no-redirect=1`
- 実行: Actions → **lighthouse (budgets, nightly)**（手動 or 深夜定期/JST 04:30 相当）

## しきい値（初期）
- `categories:performance >= 0.85`（warn）
- Budgets（warn）
  - `total` size ≤ **2.2MB**
  - `script` size ≤ **1.2MB**
  - `resource count (total)` ≤ **160**

> Required には入れていません。必要に応じてしきい値は段階的に引き締めてください。

## 例外と運用ノート
- `errors-in-console` は **warn(minScore:0)** に設定し、致命にしません（本番での一時的な警告を許容）。
- `lcp-lazy-loaded` / `prioritize-lcp-image` / `non-composited-animations` は該当ページで **Not Applicable** になるため **off**。
- `unminified-javascript` は小さなユーティリティ1本まで許容（**warn(maxLength:1)**）。
- `meta-description` は `/app/` と `/daily/latest.html?no-redirect=1` を対象にし、後者にも meta description を追加済み。

## 記録（2025-09-13 JST）
- 状態: **budgets 緑**（CI: nightly）。
- `/app/?lhci=1` の代表 LHR 抜粋:
  - Performance **0.99**
  - **TBT 0ms**
  - **max-potential-fid 61ms**
  - 警告のみ: `uses-long-cache-ttl`（=18、GitHub Pages 由来で許容）。
- 実施の最小差分（挙動不変）:
  - `public/app/sw_update.js` の**遅延起動**（idle/初回操作後）
  - 付随の初期処理後ろ倒しにより、初期フレームのメインスレッド負荷を削減
### 2025-09-12（JST）現状
  - `/app/?lhci=1`: budgets 適合 / Performance=0.75 / **color-contrast fail（要素: #dataset-error）**
  - `/daily/latest.html?no-redirect=1`: budgets 適合 / Performance=1.00

#### フォローアップ（2025-09-12 夜）
- `#dataset-error` について、背景/前景のコントラストは修正済み（赤背景+白文字）。
- 追加で **内部リンクの配色が継承されず**、青リンクが暗赤背景と低コントラストになるケースを確認。
- 対処: `#dataset-error a, #dataset-error a:visited { color: inherit !important; text-decoration: underline; }` を追加し、WCAG AA を満たすよう修正。

### 2025-09-13（JST）MPFID/TBT 微改善（任意）
- 目的: `max-potential-fid` の警告を抑制（初期フレームでの重い処理を後段へ移動）。
- 変更（挙動不変）:
  - `public/app/version-late.mjs` を新設し、**`version.mjs` の読み込み**を Idle/初回操作後へ遅延。
  - `public/app/index.html` に `version-late.mjs` を追加読み込み。
  - （別途実施済み）`public/app/sw_update.js` は **遅延初期化**へ変更済み。
- 期待効果: 初期メインスレッドの処理量削減 → MPFID/TBT の低下。


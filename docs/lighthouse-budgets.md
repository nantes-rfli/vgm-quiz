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


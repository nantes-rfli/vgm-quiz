# lighthouse (budgets, nightly)

- 目的: **退行の早期検知**（ただし誤検知を避けるため、しきい値は緩め / `warn`）
- 対象URL:
  - `/app/`
  - `/daily/latest.html?no-redirect=1`
- 実行: Actions → **lighthouse (budgets, nightly)**（手動 or 深夜定期/JST 04:30 相当）

## しきい値（初期）
- `categories:performance >= 0.85`（warn）
- Budgets（warn）
  - `total` size ≤ **2.5MB**
  - `script` size ≤ **1.5MB**
  - `resource count (total)` ≤ **200**

> Required には入れていません。必要に応じてしきい値は段階的に引き締めてください。

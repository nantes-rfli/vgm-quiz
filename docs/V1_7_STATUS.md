# v1.7 Status (Authoring Automation, MVP)

- **Status**: Done (2025-09-05)
- **Jobs**: `authoring (heuristics smoke)`, `daily (auto extended)` → 緑
- **Deliverables**:
  - `merge_seed_candidates.mjs`（seed/allowlist 統合）
  - `ensure_min_items_v1_post.mjs`（最低 1 件保証）
  - `distractors_v1_post.mjs` / `difficulty_v1_post.mjs`（MVP ヒューリスティクス）
  - `finalize_daily_v1.mjs`（フラット形 + 必須フィールド補完）
  - `validate_nonempty_today.mjs`（形状非依存）
  - `export_today_slim.mjs`（検収用アーティファクト）
- **Artifacts**: `build/daily_today.json`, `build/daily_today.md`

## Known follow-ups (v1.7.1)
- 選択肢の多様性（シリーズ/作曲者の過密回避）
- 出現頻度に基づく緩やかな難易度スケーリング
- seed/allowlist の少量拡充


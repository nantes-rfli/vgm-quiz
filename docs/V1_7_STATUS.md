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

## v1.7.1 — Applied (2025-09-05)
- 選択肢の多様性：同シリーズ/同作曲者への過密を**軽く抑制**（不足時は緩和して充足）
- 難易度の緩スケーリング：**出現頻度**に基づく微調整＋**端貼り防止マージン**
- ログ可観測性：`[difficulty] date=… values=[0.xx,...]` の**数値出力**
- allowlist/seed の少量拡充：`sources/allowlist.json` / `sources/seed_candidates.jsonl` を微増


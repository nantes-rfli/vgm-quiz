
### apple overrides (generate v2)
- `apple overrides (generate v2)` ワークフローは **JSONL未指定時に自動で seeds → score → enrich** を行い、
  `public/app/daily_candidates_scored_enriched.jsonl` を生成してから雛形を作ります。
- 従来版で ENOENT が出る場合は v2 を使用してください。

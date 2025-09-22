---
number: 43
state: closed
title: "DEV-API-CONTRACT-ALIGN (pre FE-05): JSON Schema を正本にして fixtures/MSW/FE を整合"
labels: ["type:task", "area:fe", "area:api", "priority:P1", "size:M", "key:CONTRACT-ALIGN-01"]
assignees: []
updated_at: "2025-09-22T03:25:06Z"
---
### Purpose
JSON Schema（docs/api/schemas/*.json）を唯一の正（SSOT）として確定し、fixtures・MSW・FE型を完全整合させる前準備タスク。

### Decisions (Approved)
- prompt を採用（title から移行）
- choices は Choice[]（{ id, label }）に統一（string[] から移行）
- 終了フラグは finished: boolean
- metrics レスポンスは 202 Accepted（本文なし）

### Scope / Changes
- Schema 確定: rounds_start / rounds_next / metrics_response（必要なら metrics_request）
- fixtures 更新: rounds.start.ok.json / rounds.next.ok.json を Schema 準拠に
- MSW 更新: handlers は fixtures をそのまま返し、finished のみ制御
- FE 型更新: Question 等を Schema 準拠に
- Validation: npm run validate:fixtures が常に緑（Ajv 2020-12 + ajv-formats）

### Tasks
- [ ] docs/dev/mock.md に SSOT 方針と決定事項を明記
- [ ] Schema を上記方針で確定（$id, $defs, additionalProperties:false など整備）
- [ ] fixtures を書き換え（prompt/Choice[]/finished/progress）
- [ ] MSW handlers を更新（終了判定は off-by-one 回避のため > を採用）
- [ ] FE 型/表示を更新（prompt 表示、Choice.label 採用）
- [ ] npm run validate:fixtures 緑化

### DoD
- Ajv による fixtures 検証が全て成功
- /play → /result が新 Schema/fixtures で成立
- ドキュメントに SSOT 方針が明記
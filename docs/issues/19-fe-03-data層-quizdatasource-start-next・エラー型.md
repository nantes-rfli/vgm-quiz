---
number: 19
state: closed
title: "FE-03: Data層（QuizDataSource：start/next・エラー型）"
labels: ["type:task", "area:fe", "priority:P0", "size:M", "key:FE-03"]
assignees: []
updated_at: "2025-09-22T10:16:48Z"
---
### Purpose
UIが依存するAPI窓口を1か所に集約。

### DoD
- 正常系で question/token 取得
- invalid_token/token_expired/insufficient_inventory を伝播

---
number: 18
state: open
title: "FE-02: MSW配線 + フィクスチャ起動（/v1/* 応答）"
labels: ["type:task", "area:fe", "priority:P0", "size:S", "key:FE-02"]
assignees: []
updated_at: "2025-09-20T12:42:22Z"
---
### Purpose
BEなしでAPIが動く状態にする（U1前の土台）。

### DoD
- /v1/rounds/start → 200（fixture）
- /v1/metrics → 202

---
number: 24
state: open
title: "BE-01: /v1/rounds/start & /v1/rounds/next（Tokenized Round）"
labels: ["type:task", "area:be", "priority:P0", "size:L", "key:BE-01"]
assignees: []
updated_at: "2025-09-20T12:41:55Z"
---
### Purpose
Stateless Tokenized Round 実装（JWS・短TTL・在庫不足）。

### DoD
- start/next 実装・署名検証
- insufficient_inventory を返却

---
number: 25
state: open
title: "BE-02: /v1/metrics（バッチ受け口・冪等）"
labels: ["type:task", "area:be", "priority:P1", "size:M", "key:BE-02"]
assignees: []
updated_at: "2025-09-20T12:41:57Z"
---
### Purpose
最小の計測受け口。

### DoD
- POST /v1/metrics 受理（202）
- 冪等キー（任意）を考慮

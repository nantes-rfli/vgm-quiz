---
number: 40
state: open
title: "FE: Runtime type guards for API responses and metrics payloads"
labels: ["type:task", "area:fe", "priority:P1", "size:M", "key:FE-TYPE-GUARD"]
assignees: []
updated_at: "2025-09-28T03:41:35.887489Z"
---
### Purpose
MSWモックと実APIの乖離を防ぐため、/v1/rounds と /v1/metrics のレスポンスを runtime でも検証できるよう型ガード(Zod等)を導入する。

### DoD
- rounds start/next と metrics バッチに対する runtime schema(例: Zod) を導入
- 不正レスポンス時のフェイルセーフを実装し、ログを残す
- ユニットテストで正常系/異常系を検証
- docs/dev か docs/api に整合性ノートを追記

### Notes
優先度P1。backend 側タスク(BE-01, BE-02)と歩調を合わせる。

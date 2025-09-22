---
number: 20
state: open
title: "FE-04: Questionビュー（U1）"
labels: ["type:task", "area:fe", "priority:P0", "size:M", "key:FE-04"]
assignees: []
updated_at: "2025-09-22T09:52:04Z"
---
### Purpose
1アクション開始→1問目表示（U1）。

### DoD
- 選択→結果カード表示まで通る

### Sub DoD（U1 追加仕様）
- **/play** に「**回答 → RevealCard（結果カード） → Next**」の小フェーズを挿入する
  - `next()` 応答は一旦 **`queuedNext`** に保持し、カード表示後に次問へ遷移
- 結果カード表示中のキー操作：**数字/矢印は無効化、Enter=Next** を維持（既存の ↑↓/Enter/1..9 と整合）
- プロバイダ対応（MVP）
  - **YouTube**: トグルON時は**埋め込み**＋常時リンク併記
  - **AppleMusic**: **リンクのみ**（埋め込みは将来拡張）
- **MSW/fixtures** を上記に合わせ、e2e で「1問回答 → カード表示 → Next で次問」まで通ること

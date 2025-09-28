---
number: 39
state: open
title: "FE: Accessibility audit for Play/Result flows"
labels: ["type:task", "area:fe", "priority:P1", "size:M", "key:FE-A11Y"]
assignees: []
updated_at: "2025-09-28T03:41:35.886494Z"
---
### Purpose
Play画面とResult画面のアクセシビリティを点検し、キーボード操作やスクリーンリーダー対応が不足していないかを洗い出す。

### DoD
- 主要操作（回答選択、Reveal、結果閲覧）がキーボードのみで完了できる
- 不足しているaria属性やroleを列挙し、必要に応じて修正PRを作成
- スクリーンリーダーで必要なテキスト読み上げが確認できる
- 確認内容・対応結果を docs/quality か docs/dev に記録

### Notes
必要に応じてデザイン/QAと連携。優先度はP1（早めの対応を推奨）。

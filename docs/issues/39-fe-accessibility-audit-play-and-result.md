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

### Status (2025-09-28)
- `docs/quality/a11y-play-result.md` に監査結果を記録。キーボード操作/スクリーンリーダー動作を確認し、axe-自動テストを `npm run test:a11y` で追加。
- コントラスト不足（Score/Timer バッジ）を `main`/`result` 両画面で修正済み。
- 改善候補として以下をフォローアップ:
  1. タイマー残秒を `aria-live="polite"` で読み上げる（未実装、低優先度）。
  2. 結果サマリを `<dl>` 構造等で再構成するか検討。

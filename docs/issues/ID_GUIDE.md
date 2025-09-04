# Issue ID ガイド

## 目的
- タイトル変更に強い同期を実現するため、Issue本文に **隠しIDコメント** を埋め込みます。

## 使い方
- `docs/issues/*.json` の各要素に、オプションの `id` を追加してください。
- 形式は `[a-z0-9-]+`。例: `ui-design-tokens`, `ui-choices-grid`, `authoring-harvester-min`

```jsonc
[
  {
    "id": "ui-choices-grid",
    "title": "UI: #choices グリッド2→3→4列のレスポンシブ",
    "labels": ["roadmap:v1.5", "area:ui", "responsive"],
    "body": "・・・"
  }
]
```

- 同期時、Issue本文の先頭に `<!-- issue-id: ui-choices-grid -->` が挿入され、次回以降は **ID優先で更新**されます。

## 注意
- IDは **ユニーク** にしてください（PR時に `issues (validate)` が重複を検出）。
- 既存のIssueに初回でIDを付けても、**タイトル一致で更新しつつ本文にIDが挿入**され、次回からはIDで追跡されます。


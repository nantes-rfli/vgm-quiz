## Summary
（このPRの概要を1-3行）

## Testing
（確認方法／スクショなど）

## IssueSpec (auto-create issues when label `create-issues` is attached)
Put JSON in the fenced block below.

```issuespec-json
{
  "issues": [
    {
      "key": "BE-01",
      "title": "BE-01: /v1/rounds/start & /v1/rounds/next（Tokenized Round）",
      "body": "### Purpose\nStateless Tokenized RoundのBE実装。\n\n### Scope / Changes\n- POST /v1/rounds/start\n- POST /v1/rounds/next（JWS署名・TTL・insufficient_inventory）\n\n### DoD\n- 契約スキーマに合致\n- 単体テスト通過\n",
      "labels": ["type:task", "area:be", "priority:P0", "size:M"],
      "assignees": [],
      "project": "VGM Quiz (MVP)"
    }
  ]
}
```
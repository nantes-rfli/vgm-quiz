
### トラブルシューティング（artifact_run_id で 404 になる）
- 症状: `.../actions/runs//artifacts` のように **run_id が空**で呼ばれ、404 になる
- 原因: `actions/github-script` は **workflow_dispatch の inputs を自動では受け取りません**。  
  `core.getInput('artifact_run_id')` で読む場合は、**そのステップに input を渡す必要**があります。
- 対策: 本リポの `collector (gate from artifact robust)` では、`env: RUN_ID: ${{ inputs.artifact_run_id }}` として渡し、  
  スクリプト側で `process.env.RUN_ID` を参照するように修正済みです。
- それでも 404 の場合: Run ID のコピーミス（URL末尾の数字）を確認。アーティファクトが存在しない Run を指していないか確認。

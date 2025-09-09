
### トラブルシューティング（artifact_run_id で 404 になる）
- 症状: `.../actions/runs//artifacts` のように **run_id が空**で呼ばれ、404 になる
- 原因: `actions/github-script` は **workflow_dispatch の inputs を自動では受け取りません**。  
  `core.getInput('artifact_run_id')` で読む場合は、**そのステップに input を渡す必要**があります。
- 対策: 本リポの `collector (gate from artifact robust)` では、`env: RUN_ID: ${{ inputs.artifact_run_id }}` として渡し、  
  スクリプト側で `process.env.RUN_ID` を参照するように修正済みです。
- それでも 404 の場合: Run ID のコピーミス（URL末尾の数字）を確認。アーティファクトが存在しない Run を指していないか確認。

#### 補足（by id - REST 版の理由）
- 一部環境で `actions/download-artifact@v4` の cross-run 取得が **name 指定**や **artifact-id 指定**でも DL されない事象があるため、
  REST API (`GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip`) を使って **直に zip を取得→unzip** しています。
- `downloads/` が空のときは `ls -R downloads` をログに出して調査しやすくしています。

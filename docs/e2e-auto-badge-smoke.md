# e2e (auto badge smoke)

`/app/?daily=YYYY-MM-DD&auto=1` で **AUTOバッジ**が描画されるかを Playwright Chromium で確認するスモークです。

## 使い方
- Actions → **e2e (auto badge smoke)** → Run workflow
  - `app_url` は省略可（既定: `https://nantes-rfli.github.io/vgm-quiz/app/`）
  - `date` は未指定なら **JST 今日**
- 失敗時は `auto_badge_failure.png` をアーティファクトとして取得可能

## 仕様
- まず `&auto=1` で確認し、見つからない場合は `&auto_any=1` にフォールバック（検証用途）
- 必要に応じて Required に格上げせず、ナイトリー（JST 04:25相当）で自動実行

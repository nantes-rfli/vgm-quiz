# Troubleshooting

## YAML / GitHub Actions
- **bad indentation of a mapping entry**: `- name:` 直下の `if:` / `run:` のインデントを揃える。`run: |` を使い複数行 echo を推奨。
- **if に URL を置いてしまう**: `if: ${{ steps.cpr.outputs['pull-request-url'] != '' }}` のように真偽式にする。
- **ハイフンキーの outputs**: かならず `['...']` で参照（例: `steps.cpr.outputs['pull-request-url']`）。

## /daily の挙動
- すぐリダイレクトして検証できない → `?no-redirect=1` を付与。
- 遅延させたい → `?redirectDelayMs=1500` を付与。
- 当日分が 404 → `daily.json generator (JST)` の実行状況を確認。

## AUTO が反映されない
- `?auto=1` が付いているか、曲の正規化一致があるかを確認。
- 検証では `&auto_any=1` を併用。

## PR が作られない
- 差分が無い場合は正常。Summary に `(no changes / not created)` が出る。

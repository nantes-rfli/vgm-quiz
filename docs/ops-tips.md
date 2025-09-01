# 運用 Tips（daily / workflows）

本メモは、`daily (auto)` パイプラインや `/daily/*.html` の運用でハマりやすい点をまとめたものです。

## 1. GitHub Actions の `outputs` 参照（ハイフンキー）
- `steps.<id>.outputs['pull-request-url']` のように **ブラケット記法**を使う。
- ドット記法（`steps.<id>.outputs.pull-request-url`）は **NG**。
- `if:` には **真偽値**を渡す。URL 等の「非空文字列」は避け、`!= ''` 比較などで明示する。

## 2. Summary 出力のベストプラクティス
- `run: |` を使い、複数行の `echo` を **`>> $GITHUB_STEP_SUMMARY`** に追記する。
- 日付は `RESOLVED_DATE → inputs.date → JST 今日` の順にフォールバックする。
- ワークフロー失敗でも Summary を必ず出すため、`if: ${{ always() }}` を活用する。

## 3. `/daily/*.html` のリダイレクト制御
- `/public/daily/*.html` は JS ベースのリダイレクトでアプリへ遷移する。
- 以下の URL パラメータをサポートする。
  - `?no-redirect=1` : リダイレクト抑止（デバッグ・検証用）
  - `?redirectDelayMs=1500` : 遅延（ミリ秒指定）

## 4. 差分が無いと PR を作らないのは正常
- `daily_auto.json` に変更がない場合、PR が作成されない。
- Summary では `(no changes / not created)` のように明記すること。

## 5. media（ヒューリスティック）の検証
- `allow_heuristic_media: true` で `media: {kind:"heuristic", start:...}` を生成・検証。
- 本番運用では off を基本とし、検証時のみ on を推奨。

# e2e (daily share & latest smoke)

`/daily/YYYY-MM-DD.html` と `/daily/latest.html` の **JS リダイレクト**・**デバッグ用クエリ**の基本動作を確認するスモークです。

## 使い方

- Actions → **e2e (daily share & latest smoke)** → Run workflow
  - `app_url` は省略可（既定: `https://nantes-rfli.github.io/vgm-quiz/app/`）
- またはスケジュール（JST 04:20 相当）で自動実行

## 検査内容

- `/daily/YYYY-MM-DD.html?no-redirect=1` と `/daily/latest.html?no-redirect=1` を取得（`status=200`）
- HTML に以下のいずれかが含まれることを確認
  - `location.replace(` （JS リダイレクトの痕跡）
  - `AUTOで遊ぶ` （導線の可視化）
  - `<link rel="canonical" href="../app/?daily=YYYY-MM-DD">`

## 備考

- CI **Required** ではありません（安全のため分離）。
- 直近で `daily.json generator (JST)` 実行が無いと、当日分 HTML が存在しない場合があります。

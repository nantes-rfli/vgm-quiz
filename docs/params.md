# URL Parameters

アプリとシェアページで利用できるクエリパラメータの一覧です。

## App (`/app/`)
- `daily=1` / `daily=YYYY-MM-DD` — デイリー問題の指定（JST）
- `auto=1` — AUTO モード（`public/app/daily_auto.json` から choices 反映）
- `auto_any=1` — AUTO モードの曲一致チェックを無効化（検証用途）
- `seed=...` — シード固定（決定論的な並び）
- `qp=1` — 年次バケットパイプライン（決定論的選定）
- `lives=on` / `lives=N` — ライフゲージを有効化（N=上限値）。上限到達で終了
- `test=1`, `mock=1`, `autostart=0` — ローカル検証向け
- `lhci=1`, `nomedia=1` — Lighthouse 向けスタブ・メディア無効化
- `nomusic=1` — （任意）楽曲再生を抑止して UI のみ検証（実装状況に合わせて拡張）

## Share (`/daily/*.html`)
- `no-redirect=1` — 自動リダイレクトを抑止（導線確認・デバッグ）
- `redirectDelayMs=1500` — リダイレクトを指定ミリ秒遅延

> 備考
> - リダイレクトは JS 実装。`no-redirect` / `redirectDelayMs` は `latest.html` でも利用できます。
> - `auto_any=1` は本番導線では **非推奨**（検証時のみ）。

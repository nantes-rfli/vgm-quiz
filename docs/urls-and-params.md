# URLs & Query Params

- アプリ: `/app/?daily=YYYY-MM-DD`（JST） / `/app/?daily=1`（当日）
  - `auto=1` : AUTO モード（`public/app/daily_auto.json` を 4 択に反映）
  - `auto_any=1` : 曲一致を無視して強制適用（**検証用**）
  - `seed=abc` : シード固定（決定論的順序）
  - `qp=1` : 年次バケットパイプライン
  - `lives=on` / `lives=5` : ライフゲージ（上限到達で終了／デフォルトは表示のみ）
  - `test=1` / `mock=1` / `autostart=0` : ローカル検証向け
  - `lhci=1` / `nomedia=1` : Lighthouse / メディア抑止向けスタブ

- シェアページ: `/daily/YYYY-MM-DD.html`
  - `no-redirect=1` : リダイレクト抑止（デバッグ/視認性）
  - `redirectDelayMs=1500` : 遅延してから遷移

- 最新: `/daily/latest.html` でも上記クエリが利用可能。

> 一覧性のために要点のみを抜粋しています。網羅版は **[docs/params.md](./params.md)** を参照してください。

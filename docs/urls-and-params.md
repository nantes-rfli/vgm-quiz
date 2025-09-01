# URLs & Query Params

- アプリ: `/app/?daily=YYYY-MM-DD`
  - `auto=1` : AUTO モード（`daily_auto.json` を 4 択に反映）
  - `auto_any=1` : 曲一致を無視して強制適用（検証用）

- シェアページ: `/daily/YYYY-MM-DD.html`
  - `no-redirect=1` : リダイレクト抑止（デバッグ/視認性）
  - `redirectDelayMs=1500` : 遅延してから遷移

- 最新: `/daily/latest.html` でも上記クエリが利用可能。

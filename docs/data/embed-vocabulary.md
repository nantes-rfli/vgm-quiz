# Embed Vocabulary — 最小仕様
- Status: Approved
- Last Updated: 2025-09-20

本書は結果画面における**外部メディア埋め込み/リンク**で用いるデータ語彙を最小限で定義します。  
`Question.reveal` の構造と、クライアントが参照すべきフィールドを規定します。

## 対象スキーマ（抜粋）
```json
{
  "reveal": {
    "links": [
      {
        "provider": "youtube",
        "url": "https://www.youtube.com/watch?v=XXXX",
        "id": "XXXX",           // 任意: 埋め込みパラメータ生成に利用可
        "label": "Official OST" // 任意: UI 表示用
      },
      {
        "provider": "appleMusic",
        "url": "https://music.apple.com/...", 
        "id": "YYYY"
      }
    ],
    "embedPreferredProvider": "youtube"
  }
}
```

### フィールド定義
- `reveal.links[]` — 埋め込み/外部リンク候補の配列（**provider ごとに高々1件**）
  - `provider` (enum, 必須): `"youtube" | "appleMusic"`（MVP）。将来: `"spotify" | "deezer" | "tidal"` を予約。
  - `url` (string, 必須): 公式の共有URLまたはトラックURL。
  - `id` (string, 任意): provider の動画/トラックID。埋め込みURL生成に利用可。
  - `label` (string, 任意): UIに表示する短い説明。
- `embedPreferredProvider` (enum, 任意): 埋め込みを試行する**優先 provider**。`links[].provider` のいずれか。

### バリデーション規則（最小）
- `links[].provider` は **重複不可**。
- `embedPreferredProvider` を指定する場合、**対応する link が存在**すること。
- URL は https を必須とし、provider ドメインに合致すること。

### 拡張ポリシー
- provider を追加する場合は、`provider` enum へ追記し、リンク構造と `id` の意味を**別表**に定義。
- 不可用になった provider は**語彙からは削除せず**（後方互換性維持）、`embed-policy.md` 側で無効化を宣言します。

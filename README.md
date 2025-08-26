# VGM Quiz (Step 1)


## 要件
- Clojure CLI（`clojure`コマンド）


## 使い方
```bash
clojure -M:test # テスト実行
clojure -M -m vgm.cli # 既定: 5問
clojure -M -m vgm.cli 3 # 3問
```

## 概要

* `resources/data/tracks.edn` を読み込み
* 簡単な問題をランダム生成（作曲者/作品など）
* 正解・不正解の判定とスコア表示

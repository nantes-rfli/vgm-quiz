# VGM Quiz (Step 1)

## Project Status
See [PROJECT_STATUS.md](PROJECT_STATUS.md) for current progress.


## 要件
- Clojure CLI（`clojure`コマンド）


## 使い方
```bash
clojure -M:test # テスト実行
clojure -M -m vgm.cli # 既定: 5問
clojure -M -m vgm.cli 3 # 3問
```

Kaocha is configured via `tests.edn`.

### みんはや向けエクスポート

```bash
# 既定: 30問、タブ区切り
clojure -M -m vgm.cli export
# CSV 形式
clojure -M -m vgm.cli export --format csv > out.csv
```

## Contributing data

Candidates go to `resources/candidates/*.edn` (map/vector of tracks). `:meta/*` allowed.

Provide a CSV file with the header `title,game,composer,year`:

```csv
title,game,composer,year
Megalovania,UNDERTALE,Toby Fox,2015
```

Then merge it into the dataset:

```bash
clojure -M -m vgm.cli import-csv new_tracks.csv resources/data/tracks.edn
```

## Alias proposals

クイズで誤答した際に表示される「別名として提案」ボタンから候補を保存できます。

1. 提案を溜めたら、スタート画面の「Export alias proposals (.edn)」ボタンでダウンロード。
2. CLI で既存の `aliases.edn` に統合します。

```bash
clojure -M -m vgm.aliases merge-proposals alias-proposals.edn resources/data/aliases.edn
```

3. 生成された `aliases.edn` をコミットして PR を作成してください。

## 概要

* `resources/data/tracks.edn` を読み込み
* 簡単な問題をランダム生成（作曲者/作品など）
* 正解・不正解の判定とスコア表示

## Web Preview

```bash
clojure -T:build publish
python -m http.server -d public 4444
# or: npx serve public
```

Index page displays dataset version and track count.

## Snapshot

- [Code Snapshot](https://<owner>.github.io/<repo>/)
- [Live App](https://<owner>.github.io/<repo>/app/)

## Codex sandbox validation

Run a small script to verify required files without network access:

```bash
sh scripts/validate_sandbox.sh web
sh scripts/validate_sandbox.sh build
```


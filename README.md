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

Latest code snapshot: (see GitHub Pages URL after first deploy)

## Codex sandbox validation

Run a small script to verify required files without network access:

```bash
sh scripts/validate_sandbox.sh web
sh scripts/validate_sandbox.sh build
```


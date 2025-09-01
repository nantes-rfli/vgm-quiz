# AUTO モード運用ガイド

## 目的
`daily_auto.json` に含まれる `choices`（作曲者/ゲームのダミー含む4択）を、アプリ側で安全に消費する。

## 有効化
- URL に `?auto=1` を付けてアクセス（例：`/app/?daily=2025-09-01&auto=1`）。
- 右上に **AUTO** バッジが表示される（`daily_auto.json` が読めたサイン）。
- 当日/指定日の `daily_auto.json` に `choices` があれば、4択として採用される。無ければ従来ロジックにフォールバック。

### 検証専用
- `?auto_any=1` を併用すると、曲一致チェックをスキップして **choices を強制適用**。実運用ではOFF推奨。

## CI（生成パイプライン）
- Actions → **daily (auto, candidates→score→generate)** を `with_choices: true` で実行すると、当日の `daily_auto.json` に `choices` が付与される。
- `allow_heuristic_media: true` を付けると、`media` が無い候補にも `kind: "heuristic", start: …` を付与（検証用/既定OFF）。
- 成功後 Summary には以下が表示される：
  - `daily (auto) details` … date / pick / choices_override / choices / media glance / enrich 実績
  - `daily (auto) flags` … 実行フラグの可視化
  - `daily (auto) result` … PR/Artifact モード
  - （PR 作成時）`pr: <URL>`

## /daily ページからの導線
- `public/daily/YYYY-MM-DD.html` には **「AUTOで遊ぶ」** ボタンが自動挿入される（Pages 配信前のポスト処理）。

## トラブルシュート
- **AUTO バッジはあるのに choices が効かない**  
  - `?auto=1` になっているかを確認。
  - `daily_auto.json` の対象日に `choices` が入っているか確認。
  - 当日の出題レコード（title/game/composer）が `daily_auto` の対象と **正規化一致**しているか。検証時は `?auto_any=1` を併用可。

## E2E スモーク
- Actions → **e2e (auto choices smoke)** を手動実行。Node 上で `generateChoices` と `daily_auto` の整合のみを最小確認する。

## 既知の注意点
- `daily_auto.json` の変更が無い場合は **PR は作られない**（差分なし）。Summary は常に出力される。
- AUTO バッジは `daily_auto.json` を読めたサインであり、choices の有無とは独立。


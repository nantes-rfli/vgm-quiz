# DAILY_ONEQ_PIPELINE（“1問/日” 自動MVPの流れと役割）

本ドキュメントは、v1.13 の “1問/日” 自動MVPで **何が実行され、何が生成され、ユーザーに何が届くか** を整理したものです。

---

## 1. 何が実行されるか（Actions・段階）

- **oneq (seed media_map todo)**（任意）  
  `docs/data/media_map.todo.json` を生成するだけ（雛形）。公開物なし。

- **daily (oneq dry-run)**  
  `public/build/dataset.json`（なければ Pages のリモート）＋ `docs/data/media_map.json` を参照し、  
  **埋め込みの被覆状況**を Step Summary に出す。公開物なし。

- **daily (oneq preview)**  
  Apple優先で1件 pick。**`out/daily-YYYY-MM-DD.json`** を artifact として出すだけ。公開物なし。

- **daily (oneq publish)**（本番）  
  Apple優先で1件 pick → 以下を **コミット（PR→自動マージ）** する：
  - **`public/daily/YYYY-MM-DD.json`**（新フォーマット／“唯一の正”に沿った1問の完全レコード）
  - **`docs/data/daily_lock.json`**（直近使用した `track/id` を記録して重複出題を避ける）
  - **`public/app/daily_auto.json`**（既存アプリが参照できる互換マップ；当日の1件を追記）

---

## 2. 何が生成されるか（ファイルと役割）

- **`public/daily/YYYY-MM-DD.json`（新フォーマット）**  
  1問分の**完全なメタ**（title/game/composer/track/id）と **media**（provider/id）、  
  さらに **provenance 6項目**（`source/provider/id/collected_at/hash/license_hint`）を含む。  
  用途：アーカイブ、OGP/Feeds 生成、将来のアプリ（フルJSON読込）／外部連携の**一次ソース**。

- **`public/app/daily_auto.json`（互換マップ）**  
  既存の **UI-slim v1.12 アプリ** が参照する簡易マップ。`?daily_auto=1&daily=YYYY-MM-DD` で利用。  
  用途：**即日でユーザーが遊べる導線**を確保するための**橋渡し（ブリッジ）**。将来は新フォーマット直読へ移行予定。

- **`docs/data/daily_lock.json`（ロック）**  
  直近に出した `track/id` の配列を保持。**重複出題を抑止**（最近出題回避）。“唯一の正”の方針に従い `docs/` で管理。

---

## 3. ユーザーに何が届くか（体感）

- `daily (oneq publish)` が成功すると：
  1) `public/daily/YYYY-MM-DD.json` が Pages に公開（記録用途）  
  2) `public/app/daily_auto.json` に **今日の1件** が追記される  
  3) `/daily/latest.html` の「アプリで今日の1問へ」リンクが **`?daily_auto=1`** で起動  

→ ユーザーは **リンクを押すだけで今日の自動出題が再生**できます（Apple優先→YouTube）。

---

## 4. なぜ新フォーマット（`public/daily/*.json`）を追加したか

- **完全な記録**：1問単位で provenance を満たす**自己完結JSON**を公開するため。  
- **拡張の基盤**：将来の OGP/Feeds、自動再プレイ、外部提供API等の**一次ソース**として使うため。  
- **運用の安全性**：`docs/data/media_map.json` を“唯一の正”として参照し、**埋め込みのみ**で配信。

現在のアプリは互換のため `daily_auto.json` を参照しますが、段階的に **新フォーマット直読**へ移行可能です。

---

## 5. 確認ポイント（手動検証）

1) Actions → **daily (oneq publish)** 成功  
2) リポに以下の差分がコミットされている：  
   - `public/daily/YYYY-MM-DD.json`（新規）  
   - `docs/data/daily_lock.json`（配列末尾に当日の `track/id` 追記）  
   - `public/app/daily_auto.json`（当日の1件が追記）  
3) 本番サイトで `/daily/latest.html` → 「アプリで今日の1問へ」から再生できる  
   `…/app/?daily_auto=1&daily=YYYY-MM-DD`

---

## 6. 将来の変更予定（v1.14+）

- アプリを **新フォーマット直読**に切替（`daily_auto.json` はブリッジとして段階的に廃止）  
- OGP/Feeds の自動生成と公開を追加  
- KPI 拡張（候補母数・被覆率・ロック更新件数・エラー理由集約 等）

# 引き継ぎメモ: v1.12 UI-slim Phase 2（play / media 分割）

本ドキュメントは、このチャットで実施した v1.12 Phase 2 のリファクタリング内容を要約し、次チャットへ安全に引き継ぐためのメモです。ドキュメント言語は日本語で統一しています。

---

## 1. このチャットで実施したこと（パッチ順）

- play-controller（タイマー骨格）導入  
  - `public/app/play-controller.mjs` 新設（timer / onTimeout）  
  - `public/app/app.js` からタイマー起動を配線
- media-select 抽出（Apple優先 → YouTube フォールバック）  
  - `public/app/media-select.mjs` 新設（DOM 非依存・UI 非関知）  
  - `public/app/media_player.mjs` の `chooseProvider` を移譲
- utils-ui 統合（クエリ取得ヘルパの重複排除）  
  - `getQueryParam/getQueryBool` を使用するよう置換
- play-controller: 回答フローのフックを追加  
  - `afterAnswer` / `onAnswer`、`onNext/next`、`accept/reject` / `onAccept/onReject`
- lives 配線（DI）と経路の集約  
  - `wireLives({ recomputeMistakes, maybeEndGameByLives })` を追加  
  - `refreshLives()` により **`setTimeout(recomputeMistakes,0)` → `maybeEndGameByLives()`** の歴史的順序を厳密再現
- ユニットテスト追加（`node --test`）  
  - `tests/media_select.test.mjs` / `tests/play_controller.test.mjs`
- ドキュ更新  
  - `docs/ARCHITECTURE.md` に Phase 2 の原則と今回の配線を追記  
  - `docs/issues/v1_12.json` のドキュ Issue（`v112-architecture-di-guidelines`）に進捗を反映

> すべて**挙動不変**で導入（UI 表示・ARIA・イベント順序・E2E 期待値は従来どおり）。

---

## 2. 実装の要点（DoD 抜粋）

- `app.js` は**オーケストレーター**として依存注入（DI）のみを担い、ロジックは `play-controller.mjs` / `media-select.mjs` へ移譲
- DOM 直接操作はコントローラ側に置かない（**DOM 非依存**）
- ユニットテストで **フック/API の契約**を固定化（`node --test`）
- 既存の E2E / Lighthouse の想定に影響しない（**挙動不変**）

---

## 3. 手動/自動確認（次チャットでの実施を推奨）

### 3.1 Actions での E2E まとめ実行
1. **E2E (matrix)** を手動実行（全ブラウザ/フラグ）  
2. **A11y** と **AUTO choices smoke** が含まれていることを確認  
3. すべて **緑**であれば OK（差分なし）

### 3.2 手動スモーク（任意）
- `?test=1&mock=1&seed=e2e&autostart=0` で起動→タイマー挙動/結果ダイアログの表示・共有導線の動作確認  
- `?provider=apple` / `?provider=youtube` で選択が強制されること

---

## 4. 次にやること（順番）
1. E2E まとめ実行 → 緑であれば **v1.12 Phase 2 のクローズ準備**  
2. `docs/issues/v1_12.json` の該当 Issue（下記）をクローズ  
3. v1.12 の残課題があれば `docs/issues/` に追記（唯一の正） → Actions（validate → ids assign → sync → export）

---

## 5. 関連 Issue

- `v112-architecture-di-guidelines`（ドキュ）: 本チャットで満たしたため **closed**（本パッチで state 反映）
- `v112-refactor-ui-slim-phase2`（実装）: 本チャットのパッチ群で土台は完了。E2E 緑を確認後にクローズ

---

## 6. 付記（運用の注意）

- 以後も**ドキュ → 実装**の順序で進める（差分レビュー容易化・Codex 整合性の確保）
- `docs/issues/*.json` が唯一の正。GitHub 側は Actions で上書き同期

以上。

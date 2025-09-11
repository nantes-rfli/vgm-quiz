# 引き継ぎメモ: v1.12 UI-slim Phase 2（play / media 分割）

本ドキュメントは、このチャットで実施した v1.12 Phase 2 のリファクタリング内容を要約し、次チャットへ安全に引き継ぐためのメモです。ドキュメント言語は日本語で統一しています。

---

## ステータス更新（E2E）

- **#806 v112-e2e-i18n-lang-param-smoke**：**対応完了**（2025-09-11 JST 緑）。
  - 対策：BootSeed i18n の不変条件を定義（`<html lang>` の即時設定、`<title>` を `<title>` タグ直後で最終確定、`i18n.mjs` は最終正規化のみ）。
  - 影響：挙動不変（UI/ARIA/イベント順序に変更なし）。初回 SR 読み上げの安定性が向上。

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


## 2. バグ修正（E2E: i18n lang param smoke）

- 現象: `?lang=ja` 指定時に `<html lang>` が `ja` へ遷移せず、E2E `page.waitForFunction(document.documentElement.lang==='ja')` がタイムアウト。
- 原因想定: 初期化順の競合またはネットワーク待機により、i18n 初期化前に検査が始まるケースがある（本体モジュール未読込やロケール取得失敗時でも初期反映を保証すべき）。
- 対策（最小差分・挙動不変）: `public/app/boot-params.js` で **最速のタイミング**（非モジュール）にて `?lang` を検出し、`<html lang>` を**楽観的に先行設定**。後続の `i18n.mjs` が最終的に正規化して再設定。
  - 影響範囲: `<html lang>` の初期反映が**早まるだけ**（文言差し替えやUIロジックには影響なし）
  - E2E: `e2e/test_i18n_lang_param_smoke.mjs` の `ja` 待機が満たされる

### 追加の安定化（インライン・セーフガード）
- `public/app/index.html` の `<head>` に **インライン短縮スクリプト**を追加し、`?lang` の有無に応じて **直ちに `<html lang>` を設定**。
- 理由: `boot-params.js` のネットワーク取得前に評価が走る極短時間の競合を排除（ブロッキング回避のためインライン最小化）。
- 互換: 後続の `i18n.mjs` が最終確定を行うため**挙動不変**、既存 UI/ARIA に影響なし。

### 仕上げ（タイトルの安定化）
- 原因: 初期インライン実行が `<title>` パースより**前**だと、後から `<title>` の静的文字列で**上書き**される。
- 対策: `<title>` **直後**に、`?lang`（なければ `<html lang>`）を参照して `document.title` を**最終上書き**。
  - `ja` → `VGMクイズ`
  - `en` → `VGM Quiz`
- これにより E2E `test_i18n_lang_param_smoke.mjs` の `titleJa` 取得タイミングでも安定して一致。

### 静的ラベルの初期化（E2E: i18n static labels smoke）
- 目的: モジュール i18n の初期化前に、起動直後の静的ラベル（例: Start）が言語に合わせて見えるよう **BootSeed** で軽量置換。
- 手段: `index.html` に最小辞書を持つインラインスクリプトを追加し、`DOMContentLoaded` と短時間の `MutationObserver` で
  `button / [role="button"] / a / [data-i18n] / [aria-label] / [title]` を走査し、該当文字列のみ置換。
- 原則: 本処理は**一時的な種入れ**であり、後段の `i18n.mjs` が本番辞書で再適用（**挙動不変**）。
- 安全弁: `data-boot-i18n-off` で除外可能。観測期間は 3.5s に限定し、不要な恒常書き換えは行わない。
  
#### ⬆︎ 上記は見直し：**既存 i18n を先に実行**して解決（辞書の二重管理を避ける）
- 実施: `public/app/index.html` の `<head>` で **`i18n-boot.mjs` を先行ロード**。  
  - `i18n-boot.mjs` は `initI18n()` → `whenI18nReady().then(applyStaticLabels)` を実行し、**既存の locales（`public/app/locales/*.json`）**で置換。
  - これにより **場当たり的なインライン辞書**は不要となる。
- 効果: `?lang=ja` で **Start → スタート** を、モジュール初期化直後に確実に反映。E2E は辞書由来の表記で安定。
- 原則: **辞書の単一ソース（`locales/*.json`）**を維持し、インラインの仮辞書は導入しない。

#### 追加の堅牢化（DOM 遅延マウントへの追従）
- `i18n-boot.mjs` に以下を追加し、**設計は既存 i18n のまま**で初期描画の競合だけを解消：
  - `window.addEventListener('i18n:changed', applyStaticLabels(document))` により、`setLang` 直後に**同期再適用**
  - `DOMContentLoaded` フックで DOM 構築完了時点に再適用
  - **短時間（~3.5s）の MutationObserver** で遅延マウント要素にも一次対応（恒常監視は行わない）
- これらはすべて **`applyStaticLabels`（＝ locales/*.json を使う既存API）** を呼ぶだけで、辞書の二重管理や場当たり実装はなし。

#### 方針の整理（場当たり回避）
- 「BootSeed i18n」不変条件を定義：**(1) `<html lang>` を最速でセット、(2) `<title>` はタグ直後で言語確定、(3) `i18n.mjs` は最終正規化のみ**。
- 以後、i18n 初期化順序の変更があっても、この 3 条件を満たす限り E2E と SR 初期読み上げは安定する。

> **見直し（確定方針）**  
> インラインの先行置換は撤回。辞書は **public/app/locales/*.json** の単一ソースに集約し、  
> 初期化は **i18n-boot.mjs を `<head>` で先行ロード**＋ **`i18n:changed` 同期イベント**で DOM を更新する。  
> これにより `<html lang>` が切り替わった時点で `applyStaticLabels()` が**同期的**に実行され、E2E・SR ともに初期言語が安定する。

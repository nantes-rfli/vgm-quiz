# Architecture

> 言語ポリシー: 日本語（固有名詞/API名は英語可）

## 全体像（データパイプライン）
```
        +-----------+     +---------+     +-------+     +--------+     +-------+
        | Discovery | --> | Harvest | --> | Guard | --> | De-dup | --> | Score |
        +-----------+     +---------+     +-------+     +--------+     +-------+
                                                                     (Difficulty/Notability)
                                     +--------------------------------------------+
                                     |                                            |
                                     v                                            v
                            +-----------------+                           +---------------+
                            |   Pool (在庫)   | --> pick(by_date)  --->   | Export/Front |
                            +-----------------+         (cron/bulk)       +---------------+
```

### 役割分担（Clojure / JS）
- **Clojure（`src/vgm`）**: 収集・正規化・重複排除・難易度/知名度推定などの**データ処理中核**。長時間・並列・再処理向き。  
- **JS（Actions/スクリプト/フロント）**: **オーケストレーション**（CI/PR/配信）、可視化、Webアプリ。

両者は **JSONL/JSON 契約**で接続する。例：`public/app/daily_candidates*.jsonl`、`public/app/daily_auto.json`。

### JSONL 契約（候補）
```json
{
  "provider": "apple",
  "id": "1550828100",
  "title": "Corridors of Time",
  "game": "Chrono Trigger",
  "answers": { "canonical": "Corridors of Time" },
  "provenance": {
    "source": "itunes-lookup",
    "collected_at": "2025-09-07T00:00:00Z",
    "hash": "sha1:...",
    "license_hint": "official"
  }
}
```

### スケーラビリティ指針
- **年別分割**: `public/app/by_year/YYYY.json` に分ける
- **未来地平線**: 先取りは最大90日、超過分は Pool に留める
- **PR粒度**: 30–90日/PR でレビュー可能性を確保

### 人手ドア（Human-in-the-loop）
- **Gate** で信頼度 θ 未満は PR 承認（自動マージ禁止ラベルで制御）。
- しきい値やミックスは Repo Variables で切り替え可能にする（`WITH_CHOICES`, `STRICT_GUARD`, `AUTO_GATE_THRESHOLD` など）。

## 既存 Clojure コードの位置づけ
- `src/vgm/*.clj[cs]` の処理は **ingest / aliases / export / stats** 等に対応。  
  これらを上図の **Harvest/Normalize/De-dup/Score** に段階的に寄せていく。

## 失敗時のリカバリ
- いつでも **停止できるスイッチ**（Repo Variables / Workflow inputs）。
- **ロールバック**：PR単位/日付単位で `by_date` を戻す手順を定義。

(以降、既存記述)

## Data -> App -> Pages
1. **Data Build (Clojure)** → `public/build/dataset.json`
2. **Node Scripts** → `public/app/daily.json`, `public/app/daily_auto.json`, `/public/daily/*.html`
3. **App (GitHub Pages)** → `/public/app/` を配信、`?daily=...` で表示
4. **SW 更新検知** → `public/app/version.json` でハンドシェイク（~60s）

## Pipelines
- **daily.json generator (JST)**: daily.json と /daily HTML を更新
- **daily (auto …)**: daily_auto.json を更新（HTML には触れない）

## E2E / Monitoring
- smoke テスト（/daily + latest / AUTO バッジ）
- Lighthouse Budgets（warn）

## フロントエンド（app/）の起動分割（v1.12 Phase 1）
- `boot-params.js`: URL 検索パラメータと `__IS_TEST_MODE__` を先読みして公開（副作用なし）。
- `sw-register.js`: Service Worker 登録の薄いラッパ。`registerSW(version, onWaiting)` を提供。
- `i18n-boot.mjs`: i18n 初期化と静的ラベル適用・`i18n:changed` ハンドラを集約。
- `version.mjs`: バージョン情報の読込（`readVersionNoStore` など）を集約。TTL/ETag メモ化は従来通り。
- `a11y-helpers.mjs`: 起動時に `initA11y()` を呼び、タイマー/プログレスバーなどの ARIA 属性の整備を行う。

> 目的: `public/app/app.js` の責務を明確化し、将来の UI 分割（Phase 2 以降）の基盤にする。

## フロントエンド（app/）の起動分割（v1.12 Phase 2）
- `daily.mjs`: デイリーモードの状態（`DAILY`）とヘルパ（`detectDailyParam` / `initDaily` / `pickDailyWantedFromMap` / `applyDailyRestriction`）を集約。
- `result-dialog.mjs`: 結果ダイアログのA11y制御と共有導線（コピー/Share）を集約。`setupResultShare(buildResultShareText)` を提供。

### v1.12 Phase 2 — 集約単位と依存注入（DI）の原則

**狙い**: 画面単位の分割を安全に進めるための基準を明文化する（Codex等のブレに依存しない）。

#### 集約単位（最小スコープ）
- **play-controller.mjs**（新設）  
  責務: タイマー（`startCountdown` / `stopCountdown`）、残機（lives）監視、回答フロー（accept/reject/next）の集約。  
  提供: `createPlayController(deps)` → `{ start(), stop(), onAnswer(cb), onTimeout(cb) }`。**DOM直接操作はしない**。
- **media-select.mjs**（新設）  
  責務: **Apple優先 → YouTubeフォールバック**の選択ロジックとプレーヤ初期化。  
  提供: `createMediaSelector(deps)` → `{ pickFor(track), currentProvider(), teardown() }`。`providers.mjs` のIFのみに依存し、描画は呼び出し側。

#### 依存注入（DI）
- 原則: **モジュール単位のシングルトン禁止**。すべて **ファクトリ関数**で依存を受け取る。
- 標準依存: `{ i18n, version, providers, storage, logger }`（必要なものだけ受け取り可）。
- **app.js はオーケストレーター**: 起動時に `deps` を構築し、`play-controller` と `media-select` を生成して配線する。
- テスト: `node --test` は **フェイク依存**（ダミー providers / fake storage）を注入。E2E は公開APIの挙動を確認。

#### 挙動不変の原則（DoD）
- UIの見た目・操作フローは **不変**。ARIA属性・イベント発火順も変更しない。
- 既存 E2E（A11y/AUTO/結果ダイアログ）と Lighthouse が **緑**であること。
- `public/app/app.js` からは **イベント配線のみ**が残り、ロジックは本節のモジュールへ移譲されている。

#### 段階的抽出ガイド
1) `play-controller` の骨格導入（`start/stop` と timeout のみ）→ E2E 緑  
2) 残機と回答フローを移譲 → E2E 緑  
3) `media-select` を導入し、Apple/YouTube 選択を移譲 → E2E 緑  
4) リファクタ後に **差分レビュー**（提案との整合チェック）を実施。

#### Phase 2 追加: ライフ配線とフローフック（このチャットで導入）
**目的**: 残機/HUD の再計算と終了判定、回答後のフローハンドリングを **play-controller** 経由に集約しつつ、**挙動不変**を担保する。

- `play-controller.mjs` に以下を追加（UI非依存・DOM非操作）:
  - `onNext(cb)` / `next()`：次問遷移の**入口**を集約（`app.js` の `nextQuestion` を DI で注入）
  - `accept(payload)` / `reject(payload)` / `onAccept(cb)` / `onReject(cb)`：回答結果の**通知フック**（委譲のみ）
  - `afterAnswer({ correct, remaining })` / `onAnswer(cb)`：回答直後の**後処理フック**
  - `wireLives({ recomputeMistakes, maybeEndGameByLives })`：既存 HUD 再計算・終了判定を**参照注入**
  - `refreshLives()`：歴史的順序 **`setTimeout(recomputeMistakes,0)` → `maybeEndGameByLives()`** を厳密再現

- `app.js` 側の扱い:
  - 起動時に `onNext(nextQuestion)` と `wireLives({ recomputeMistakes, maybeEndGameByLives })` を配線
  - タイムアウト経路は `submitAnswer()` → `__PLAY__.next()` にラップ（最終結果は従来と同一）
  - `submitAnswer()` 内で正誤に応じて `accept/reject/afterAnswer` を**通知のみ**（副作用は従来ロジックのまま）

**不変条件（DoD）**
- UI 表示・ARIA・イベント順序は従来と完全一致  
- 既存 E2E（A11y/AUTO/結果ダイアログ）/ Lighthouse が緑  
- 依存はすべて **関数参照注入（DI）** とし、テストではフェイク依存に差し替え可能

**テスト**
- Node 標準の `node --test` によるユニットテストを追加（`tests/`）。`play-controller` と `media-select` の要点を検証。

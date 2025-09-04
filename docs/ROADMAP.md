# VGM Quiz Roadmap (v1.x)

目的: v1.0.1 以降の開発方針を明確化し、**小さな安全な前進**を積み重ねる。各マイルストーンには**受け入れ基準 (DoD)** を設定。

> **Note on source of truth**
> - 機能の正本は **`docs/FEATURES.yml`**（implemented / planned / deprecated）。
> - 本ドキュメントは **背景・優先度・DoD の物語**を与える位置付けです。
> - CI の **roadmap-guard** が、FEATURES の `planned` がRoadmapに現れない場合に **非ブロッキング警告**を出します。
> - Docs の更新漏れは **docs-enforcer** が検知（コード変更のPRでDocs差分が無ければ fail、`docs:skip` ラベルで明示除外可）。

---

### Status quick view（v1.x）
| Version | Status | Highlights (Done) | Remaining (key) |
|---|---|---|---|
| v1.1 | **Done (2025-09-02)** | AUTOトースト/設定UI/バッジA11y、latest CTA・meta、軽量E2E | — |
| v1.2 | **Done (2025-09-02)** | 正規化ケース拡充、Node/Browserパリティ、alias衝突スモーク、CTA監視、Budgets微調整、Docs整備 | — |
| v1.3 | **Done (2025-09-03)** | Budgets引き締め、Lazy import、Worker JSON parse、LHCI配線修正 | — |
| v1.4 | **Done (2025-09-04)** | A11y最小セット（live region/roles/labels/`aria-describedby`）＋ダイアログのフォーカストラップ/復帰＋背景 inert + scroll lock＋a11y static checker（static smoke） | — |
| v1.5 | **Done (2025-09-04)** | UI/Responsive polish（トークン/44px/2→3→4列/微トランジション/ライト調整/E2E緑） | — |
| v1.6 | **Done (2025-09-05)** | i18nベースライン（UI文言辞書/言語選択/`<html lang>` 等） | — |

## 現状 (v1.0.x Stabilization) — 完了/運用中
- キーボード操作（Tab/Enter/Space の基本操作）: **実装済み（Baseline）**
- /daily の **JS リダイレクト化**（`?no-redirect=1` / `?redirectDelayMs` 対応）
- **daily.json generator (JST)** による `/public/daily/*.html` 生成（生成元を修正済み）
- **daily (auto …)** は `/public/app/daily_auto.json` のみ更新（HTML には触れない）
- E2E: **daily share & latest smoke**, **AUTO badge smoke (Playwright)**、**auto choices smoke**
- 監視: **Lighthouse Budgets (warn)**、**link-check (docs)**
- 運用: PR/Issue テンプレート、CONTRIBUTING、Docs ハブ

**DoD**
- 主要 E2E が緑、Pages デプロイ後の手動確認が安定
- 既知の落とし穴（hyphenated outputs、if 真偽式）を回避するテンプレ & Tips が整備

---

## v1.1 — AUTO モード品質 & UX の底上げ（最優先） — *(Done 2025-09-02)*
- Deliverables: AUTO起動トースト、Start設定UI（AUTOを有効にする・永続化）、AUTOバッジのA11y（aria-label）。
**狙い**: “AUTOで遊ぶ”の価値を安定供給する。

**機能/変更**
- AUTO ON トースト（?auto=1 / 設定ON で起動時に通知）
- AUTO 設定の永続化（スタート画面にチェック、localStorage.quiz-options.auto_enabled）
- E2E（AUTO choices 可視性）: 4択 DOM にテキストが **4件** 描画されていることを軽量確認
- 正規化の境界条件を補強（英数の大小/全角半角/記号の扱いの統一テスト）
- /daily の導線微調整: JSリダイレクト発火前のボタン表示の安定性確認（latest 含む）

**DoD**
- E2E: AUTO choices 可視性スモーク **緑**（連日）
- “`?auto=1` でバッジ可視” と “4択描画あり” が揃って確認できる
- 既存 Required への影響ゼロ（独立ワークフロー or Required 非連動のまま）

---
- AUTO起動トースト（?auto=1 / 永続ON時、1セッション1回表示）
- Start画面：『AUTOを有効にする』（localStorage: `quiz-options.auto_enabled`）
- AUTOバッジのA11y強化（`role=status` / `aria-live=polite` / `aria-label`）
- latest.html：CTA『アプリで今日の1問へ』を表示（ジェネレータ＋postbuildガード）
- latest.html：`meta name=description` を恒久化（postbuildガード）
- 軽量E2Eの追加（latest meta / auto settings）、既存E2E・Lighthouseは緑継続
## v1.2 — データ拡張 (media/難易度) の土台づくり — *(Done 2025-09-02)*
**狙い**: クイズ体験にリッチさとバリエーションを追加。

**機能/変更**
- AUTO ON トースト（?auto=1 / 設定ON で起動時に通知）
- AUTO 設定の永続化（スタート画面にチェック、localStorage.quiz-options.auto_enabled）
- `allow_heuristic_media: true` の **安全ガード**（不在/404/遅延時のフォールバック勝ち順）
- 難易度スコア（仮: `difficulty`）を `daily.json` に付与（ヒューリスティック + しきい値）
- UI: 難易度バッジ（表示のみ、フィルタは後続）

**DoD**
- `daily.json` スキーマに `difficulty` が追加され、アプリで表示
- media が有効化された日の E2E でも落ちない（存在しない場合は安全に無視）

---

- 正規化ケースの拡充（全角/波ダッシュ/ローマ数字境界/スラッシュ 等）
- Node/Browser **normalize parity** サンプルの拡充
- **エイリアス正規化衝突スモーク**（aliases の正規化キー衝突検知）
- `latest.html` CTA の恒久化を**E2Eで監視**（presence）
- Lighthouse Budgets を**安全幅で**微調整（早期退行検知）
- Docs整備（CI/運用/ガード、正本の一本化・参照修正）

## v1.3 — パフォーマンス強化 (Hardening)
- Status: **Done** (2025-09-03)
- Highlights:
  - Budgets tightened: total ≤ 2.2MB / script ≤ 1.2MB / requests ≤ 160
  - Lazy imports: `boot_auto.mjs`（auto系条件読込）, `media_player.mjs`（メディア時のみ）
  - Off-main-thread JSON parse（Worker）: `dataset.json` / `aliases*.json`
  - Alias構築の段階的処理（小分けyield）＋起動時のロード停止（Start後に非同期読み込み）
  - Fuzzy距離（`levenshtein`）を `fuzzy.mjs` に分離し回答時のみ動的読込
  - LHCI配線修正：`budgetsPath` 有効化、`/app/?lhci=1` で解析スクリプト除外
  - uses-long-cache-ttl は WARN 監視（最大12件許容、運用ドキュメント追記）
- Release Notes: see `docs/releases/v1.3.md`（tag: v1.3, date: 2025-09-03）


### Planned
- **media-provider-order**: Apple Music preview を優先、YouTube 公式を補完（`media_player` のプロバイダ順）
- **clip-start-heuristics-v2**: 開始秒の推定ルール強化（クエリ/メタ/タイムコード規則 → 将来は音響）
- **difficulty-v2**: 追加シグナル（年代/別名密度/シリーズ知名度 等）で安定化
- _(umbrella: **heuristic-media-guard**)_

### DoD (minimum)
- **media-provider-order**
  - Apple Music が取れる場合は **Apple優先**、無い場合は **YouTube公式** に自動フォールバック。
  - `media_player.mjs` に実装。`?provider=` 等の**開発用強制切替（dev flag）**を用意（手動検証用）。
  - **軽量E2E（静的）**：指定データで `<iframe>`/`<audio>` の**いずれかが出力される**ことを確認。
- **clip-start-heuristics-v2**
  - start秒は **0以上**・**音源長未満**・**既定値のフォールバック**3条件を満たす。
  - ルール：クエリ/メタ/タイムコード（`t=`/`start=`）を優先、無ければ既定値。
  - **ユニットテスト**：代表ケース（明示/欠落/異常値）で期待値に収束。
- **difficulty-v2**
  - 追加シグナル（年代/別名密度/シリーズ知名度 等）を合成し **[0..100]** で安定出力。
  - Node/Browser **parity 緑**（既存パリティにケースを追加）。
  - **リグレッション**：v1系既存問題の難易度分布が**極端に崩れない**（中央値±10pt以内）。

## v1.4 — アクセシビリティ（最小）
- Status: **Done (2025-09-04)**
- Scope: A11y minimal set (focus, landmarks, labels, live regions, keyboard)
- Tests: a11y smoke (static) + existing E2E a11y
**狙い**: 既存のキーボード操作 Baseline を**壊さず**、a11y をハードニング。

**現状**
- Tab で選択肢にフォーカス遷移、Enter/Space で確定は **実装済み**

**機能/変更**
- ライブリージョン：`#feedback` に `role="status" aria-live="polite" aria-atomic="true"`
- ランドマーク/領域：履歴 `role="region" aria-labelledby="history-heading"`（見出しは視覚非表示）
- 選択肢のまとまり：`#choices` に `role="group" aria-label="Choices"`、`aria-describedby="prompt"`
- 選択状態：選択肢に `aria-pressed` を付与し、クリック/キーボードで同期
- 結果ダイアログ：`role="dialog" aria-modal="true"`、初期フォーカス/Tabトラップ/ESCクローズ/復帰 **＋ 背景 inert / aria-hidden / スクロールロック**
- テスト：`e2e (a11y static smoke)` を追加し、上記を静的に検証（静的チェッカ: `script/a11y_static_check.mjs` / ワークフロー: `.github/workflows/a11y-static.yml`）
**DoD**
- 既存のキーボード操作が落ちない **回帰 E2E（軽量）**
- コントラストとフォーカスリングが目視で明確
- 主要要素に適切なロール/ラベルが付与
- a11y 静的スモーク（`a11y (static smoke)`）が緑
- （任意）axe-core の quick pass で重大項目が発生しない

**Notes**
- 背景抑止は `public/app/app.js` の `openResultDialogA11y` / `closeResultDialogA11y` で `inert` / `aria-hidden` / scroll lock を付与・解除
- 動作確認 E2E：`e2e/test_results_modal_inert.mjs`

---

## v1.5 — UI/Responsive polish（細部）
- Status: **Done (2025-09-04)**
- Scope: CSSのみでの軽量磨き上げ（JS増やさない方針）

**機能/変更**
- デザイントークンの導入（色/余白/角丸）と一貫スタイル（ボタン/入力）
- タッチターゲット最小 44px を満たす（モバイル）
- `#choices` のグリッド：2→3→4 列（画面幅に応じて）
- History テーブルのストライプ/ホバー
- 微小トランジション（opacity/transform のみ）
- ライトテーマのコントラスト微調整／アクセント色の再確認

**DoD**
- Lighthouse（A11y/Best Practices/Performance）で現状維持以上、Budgets は不変
- 主要E2Eは緑のまま（JSを増やさないため a11y/perf に影響なし）

> **実装反映済み**: `e2e (ui responsive smoke)`, `e2e (ui motion reduce)` は緑、README にバッジ追加済み。詳細は **`docs/STYLEGUIDE_UI.md`** を参照。
## v1.6 — i18n ベースライン
**Status:** **Done (2025-09-05)**
**狙い**: UIテキスト/ラベルを辞書化し、言語切替（ja/en）を可能にする。初期バンドルの悪化は避け、`en` 同梱・`ja` 遅延ロードの方針。

**機能/変更**
- `public/app/i18n.mjs` を導入（`detectLang` / `loadLocale` / `t` / `setLang` / `initI18n`、`<html lang>` 更新）
- `public/app/locales/{en,ja}.json`（最小キーはタイトル・主要ボタン・a11yメッセージ）
- `?lang=en|ja` での明示切替（なければ `navigator.language` を優先）
- 主要画面の文言を段階的に外部化（Start/History/Share → クイズ本文へ）
- 日付/数値表示を `Intl.DateTimeFormat/NumberFormat` に統一
- a11y メッセージ（live region など）をキー管理に統合

**Progress**
- ✅ i18nコア（`public/app/i18n.mjs`）と最小辞書（`locales/en, ja`）導入
- ✅ `document.title` と `<html lang>` の切替（`?lang=` / `localStorage`）
- ✅ E2E: `e2e (i18n lang param smoke)` 緑
- ✅ 外部化ステップ1（Start/History/Share の静的ラベル）＋ E2E（labels smoke）
- ✅ 外部化ステップ2（再スタート/コピー/シェア結果/見出し 等の静的ラベル）
- ✅ `Intl.DateTimeFormat` ヘルパー（`formatDate/Time/DateTime`）を導入（未適用・後続で置換）
- ✅ Missing Keys チェッカ（CI）導入：`.github/workflows/i18n-missing-keys.yml`
- ✅ a11yメッセージのキー化（`#feedback` の ready/results を `a11y.*` に集約）＋ **E2E: i18n a11y live region** 緑

**DoD**
- `?lang=en/ja` で `<html lang>` と表示テキストが切り替わる
- 未翻訳キーは英語フォールバック
- 初期バンドルサイズの悪化無し（`en` のみ同梱、`ja` は遅延）
- E2E スモーク（lang param）と未翻訳キー静的チェッカが緑

**初期Issue（種）**
1. i18n-core-module：`i18n.mjs` の追加と初期化配線
2. locales-en-ja：`en.json`/`ja.json` の作成（最小）
3. wiring-init-in-app：`initI18n()` を `app.js` 起動時に呼び出し
4. replace-strings-step1：Start/History/Share のテキスト外部化
5. intl-dates-numbers：日付/数値の Intl.* 置換
6. a11y-messages-to-keys：a11yメッセージのキー化
7. e2e-i18n-lang-param-smoke：`?lang=ja|en` の表示スモーク
8. static-checker-missing-keys：未翻訳/未使用キー検出スクリプト
9. docs-styleguide-i18n-roadmap：STYLEGUIDE/ROADMAP の更新
## v1.7 — Authoring Automation（MVP）
- Status: **Planned**
- Scope: “**毎日1問**”を**完全自動**で作成・公開。**埋め込み再生のみ**（Apple Music / 公式YouTube）前提で、既存アプリは変更せず供給ラインを自動化。

**機能/変更**
- 候補ハーベスト：公式YouTube/Apple API優先（非公式は除外）。レート制御・失敗時リトライ。
- clip-start 選定：`t=/start=` > メタ > 既定値のヒューリスティック。異常値ガード。
- 難易度スコア：年代/別名密度/シリーズ知名度などから 0–100 を算出。
- ダミー選択肢生成：年代/作曲者/シリーズ近傍から類似度で抽出。
- 正規化 & 重複ガード：既存 normalize と aliases を使用。ユニーク性ロックで衝突回避。
- 日次JSON & OGP：`public/daily/YYYY-MM-DD.json`/OGP画像生成、`latest.html` 導線と整合。
- 安全ガード：最小品質チェック（再生可否・メタ必須・配信元ホワイトリスト）。失敗時はスキップ&通知。

**DoD（受け入れ基準）**
- `schedule: daily` で **連日1問**を安定生成。失敗はJob Summaryで理由明示。
- 生成JSONに **ソースURL** と **再現可能なseed** を保持（トレース可能）。
- 既存アプリ側の **JS重量やパフォーマンスに変化なし**（埋め込み再生のみ）。
- 既存 E2E/Lighthouse は緑維持。パイプライン用に **軽量スモーク**（再生可否/JSON schema 等）を追加。

**リスク/除外**
- 非公式・権利曖昧ソースは対象外。
- 自動判定の信頼度が一定閾値未満の場合は **自動スキップ**。

**依存関係**
- v1.6 i18n ベースライン（UIテキスト/ラベルの多言語化）。
- 既存 normalize / aliases / E2E 基盤。

**初期Issue分解（案）**
1. harvester-min：公式ソースの収集器（レート制御・失敗時リトライ）
2. clip-start-heuristics-v1：開始秒ルールと異常ガード + ユニットテスト
3. difficulty-v1：簡易指標からの合成スコア + パリティ/分布チェック
4. distractors-v1：年代/作曲者/シリーズ近傍からの抽出 + 最低品質ガード
5. authoring-schema：生成JSONスキーマ定義 + schema検証
6. daily-publish：日次JSONとOGP生成・配置 + latest連携 + E2Eスモーク
7. ops-docs：Secrets/PAT/失敗時の運用手順、監視ポイントを docs へ整備

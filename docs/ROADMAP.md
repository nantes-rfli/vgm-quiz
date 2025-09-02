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
| v1.3 | **In progress** | Budgetsの安全幅を僅かに縮小 | 未使用アセット削減、遅延読込/プリロード最適化、SW堅牢化 |
| v1.4 | **In progress** | AUTOバッジA11y（静的テスト付）、キーボード操作維持 | フォーカスリング、主要ロール/ラベル、簡易aXeチェック |
| v1.5 | **Planned** | — | i18nベースライン（UI文言辞書/言語選択/`<html lang>` 等） |

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
**狙い**: 体感を落とさずに退行を抑止。

**機能/変更**
- AUTO ON トースト（?auto=1 / 設定ON で起動時に通知）
- AUTO 設定の永続化（スタート画面にチェック、localStorage.quiz-options.auto_enabled）
- Lighthouse Budgets の **段階的引き締め**（warn のまま閾値を少しだけ上げる）
- 画像/JS の軽量化: 使用していないアセットの削減、遅延読込の徹底、プリロード最適化
- SW: ポーリング間隔とハンドシェイク処理の堅牢化（ネットワーク劣化時の挙動）

**DoD**
- 新しい Budgets でも **継続的に warn 未満**
- 主要ページの初回描画に退行なし（体感/スナップショットで確認）

---

## v1.4 — アクセシビリティ & i18n（最小）
**狙い**: 既存のキーボード操作 Baseline を**壊さず**、a11y をハードニング。

**現状**
- Tab で選択肢にフォーカス遷移、Enter/Space で確定は **実装済み**

**機能/変更**
- AUTO ON トースト（?auto=1 / 設定ON で起動時に通知）
- AUTO 設定の永続化（スタート画面にチェック、localStorage.quiz-options.auto_enabled）
- フォーカス可視化の明確化（focus ring, :focus-visible）
- ARIA ロール/ラベルの付与（選択肢/ボタン/ランドマーク）
- フォーカス順序と読み上げ文言の点検（スクリーンリーダー簡易確認）
- i18n の準備（文言抽出と言語切替の土台）

**DoD**
- 既存のキーボード操作が落ちない **回帰 E2E（軽量）**
- コントラストとフォーカスリングが目視で明確
- 主要要素に適切なロール/ラベルが付与
- （任意）axe-core の quick pass で重大項目が発生しない

---

## v1.5 — 体験向上の小粒機能（クライアントのみ）
**狙い**: バックエンドなしで楽しさを増す。

**機能/変更**
- AUTO ON トースト（?auto=1 / 設定ON で起動時に通知）
- AUTO 設定の永続化（スタート画面にチェック、localStorage.quiz-options.auto_enabled）
- ローカルの連続記録（streak）、前回スコアの保存（localStorage）
- 結果の共有リンク（クエリ or フラグメントでシード化）
- テーマ切替（ライト/ダーク）

**DoD**
- 端末ローカルのみで完結。プライバシー影響なし
- 共有リンクから同じ問題セットを再現可能（範囲限定で）

---

## Backlog / 調査項目
- PWA（オフライン対応・音声/画像のキャッシュ戦略）
- クリエイター向けツール（データ編集/可視化）
- サーバレス連携（スコア共有、ランキング）※現状スコープ外

---

- A11y hardening *(ID: `a11y-hardening`, area: a11y)*
- Difficulty badge (display-only) *(ID: `difficulty-badge`, area: ui)*
- Heuristic media with safe fallback order *(ID: `heuristic-media-guard`, area: media)*

## バージョニング方針 / リリース運用
- **SemVer 準拠**: 互換を壊さない機能追加は **minor**（v1.1, v1.2…）、修正は **patch**（v1.0.2…）
- リリース条件（共通 DoD）:
  - 主要 E2E が緑（/daily share & latest, AUTO badge, AUTO choices 可視性）
  - Pages 配信を手元で確認（`/daily/YYYY-MM-DD.html?no-redirect=1`）
  - Lighthouse Budgets が warn 未満
  - 反映確認: フッター右の Dataset/commit/updated

---

## 次にやること（Kick-off）
- v1.1 の Issue を分解して作成（`roadmap:v1.1` ラベル）
  - AUTO choices 可視性の E2E 追加（ヘッドレス、軽量 DOM チェック）
  - 正規化の境界テストを Node/Browser 両系で補強
  - /daily 導線（先にボタン表示）の最小検証
- Project ボード（ミニ）を作成し、v1.1 の DoD をカードで可視化
- v1.1 が固まったら、v1.2 の設計メモ（media フォールバック順、difficulty 算出のルール）を下書き

> **Note on version labels**: このドキュメントの **v1.x** は “テーマ別マイルストン” の便宜上の番号で、SemVer ではありません。  
> 実際の出荷は **Gitタグ（vMAJOR.MINOR.PATCH）** で管理し、`CHANGELOG.md` に記録します（1:1 対応ではありません）。

## v1.5 — 国際化（i18n）ベースライン
**狙い**: vgm-quiz 全体の国際化に向けた土台整備。まずは UI 文字列から最小で始め、将来の拡張（問題文・説明など）に備える。

**機能/変更**
- **i18n コア（`i18n-core`）** — Internationalization baseline (JP/EN)
  - キー駆動の UI 文言辞書（`public/app/i18n/{ja,en}.json` など）
  - ロケール決定: `?lang=ja|en` > `localStorage.lang` > `navigator.language`（`ja`/`en`に正規化）
  - Start 画面に **言語トグル**（JP/EN）を追加（アクセシブルな `<fieldset>` / `<legend>` / `<label>`）
  - `<html lang="…">` / `<title>` / `<meta name="description">` のローカライズ
  - A11y: `aria-label` / `aria-live` 文言のローカライズ
  - E2E（light）: 言語切替でヘッダ/ボタン文言が切り替わることのスモーク

**非対象（別フェーズで検討）**
- データセット（曲名/ゲーム名/解説）の翻訳・翻字
- OGP 画像の言語別レンダリング

**DoD**
- `?lang=ja` / `?lang=en` で UI 文言が切り替わる
- Start の言語トグルで選択→リロード後も保持（`localStorage.lang`）
- `<html lang>` と `<title>`/`<meta name="description">` がロケールに一致
- E2E（light）で `/app/?test=1&lang=en` 時に英語 UI が確認できる



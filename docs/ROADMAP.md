# VGM Quiz Roadmap (v1.x)

目的: v1.0.1 以降の開発方針を明確化し、**小さな安全な前進**を積み重ねる。各マイルストーンには**受け入れ基準 (DoD)** を設定。

---

## 現状 (v1.0.x Stabilization) — 完了/運用中
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

## v1.1 — AUTO モード品質 & UX の底上げ（最優先）
**狙い**: “AUTOで遊ぶ”の価値を安定供給する。

**機能/変更**
- E2E（AUTO choices 可視性）: 4択 DOM にテキストが **4件** 描画されていることを軽量確認
- 正規化の境界条件を補強（英数の大小/全角半角/記号の扱いの統一テスト）
- /daily の導線微調整: JSリダイレクト発火前のボタン表示の安定性確認（latest 含む）

**DoD**
- E2E: AUTO choices 可視性スモーク **緑**（連日）
- “`?auto=1` でバッジ可視” と “4択描画あり” が揃って確認できる
- 既存 Required への影響ゼロ（独立ワークフロー or Required 非連動のまま）

---

## v1.2 — データ拡張 (media/難易度) の土台づくり
**狙い**: クイズ体験にリッチさとバリエーションを追加。

**機能/変更**
- `allow_heuristic_media: true` の **安全ガード**（不在/404/遅延時のフォールバック勝ち順）
- 難易度スコア（仮: `difficulty`）を `daily.json` に付与（ヒューリスティック + しきい値）
- UI: 難易度バッジ（表示のみ、フィルタは後続）

**DoD**
- `daily.json` スキーマに `difficulty` が追加され、アプリで表示
- media が有効化された日の E2E でも落ちない（存在しない場合は安全に無視）

---

## v1.3 — パフォーマンス強化 (Hardening)
**狙い**: 体感を落とさずに退行を抑止。

**機能/変更**
- Lighthouse Budgets の **段階的引き締め**（warn のまま閾値を少しだけ上げる）
- 画像/JS の軽量化: 使用していないアセットの削減、遅延読込の徹底、プリロード最適化
- SW: ポーリング間隔とハンドシェイク処理の堅牢化（ネットワーク劣化時の挙動）

**DoD**
- 新しい Budgets でも **継続的に warn 未満**
- 主要ページの初回描画に退行なし（体感/スナップショットで確認）

---

## v1.4 — アクセシビリティ & i18n（最小）
**狙い**: ゲーム体験の基礎品質を底上げ。

**機能/変更**
- キーボード操作、コントラスト、役割属性の付与などの a11y 最低ライン
- 文言抽出（i18n 準備）と言語切替の土台（日本語が既定）

**DoD**
- キーボードのみでクイズ完了可能（Tab/Enter/Space で操作）
- 主要コントラスト比のチェック通過（目視/簡易ツール）

---

## v1.5 — 体験向上の小粒機能（クライアントのみ）
**狙い**: バックエンドなしで楽しさを増す。

**機能/変更**
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


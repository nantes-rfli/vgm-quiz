# Phase 2+ ロードマップ — ストック型クイズ運用

- **Status**: Draft
- **Last Updated**: 2025-10-13

本ドキュメントは、Phase 1（2025-10-10 時点で完了）の成果を基盤に、クイズ体験を「日替わりセット限定」から「大量ストックを活用した柔軟な出題プラットフォーム」へ拡張するための大枠を整理する。`docs/api/api-spec.md` に記載済みの Manifest/API 構想を再採用しつつ、段階的に実装することで、後続の開発者が方向性を誤解しないよう具体的な成果物と合意事項を明文化する。

## 0. Phase 1 の整理（リマインド）

- 2025-10-10 時点で、Cloudflare Workers による日替わり配信（`GET /v1/rounds/start` 固定・当日分のみ）と R2/D1 パイプライン（Discovery → Publish）が動作済み。
- MSW フロントエンドモックは Phase 1 仕様の JSON を再現済みだが、Manifest やフィルタ選択 UI は未実装。
- 課題: 当日分のみ有効な API のため、当日 Export が欠けると 503 が返却される。ストック型運用や難易度／ジャンル別の出題は未対応。

## 1. ガイディング原則

1. **ストック優先** — D1 に蓄積したトラックを任意条件でサンプリングし、日替わりセットは「プリセット条件の一種」として扱う。
2. **Manifest ドリブン** — フロントが利用可能なモード／ファセットを `GET /v1/manifest` で取得し、API 契約と同期を保つ。
3. **トークン一貫性** — `POST /v1/rounds/start` `POST /v1/rounds/next` は Manifest で示す条件と JWS トークンを通じて進行状態を保持する（docs/api/api-spec.md の計画通り）。
4. **後方互換への配慮** — 移行期間中は Phase 1 の日替わり仕様を壊さず、フロントと API の切り替えを Feature Flag で段階的に行う。
5. **データファセット充実** — 難易度・ジャンル・シリーズ等のメタデータを D1/curated.json に追加し、フィルタ条件の妥当性を保つ。

## 2. フェーズ区分と成果物

| フェーズ | 期間目安 (暫定) | 主な成果物 | ブロッカー / 前提 |
| --- | --- | --- | --- |
| **Phase 2A — データ整備** | 2025-10-14〜2025-11-01 | `tracks_normalized` メタ拡張、`track_tags`/`track_difficulty` など新テーブル、`curated.json` フォーマット更新、データ検証スクリプト | Biome/tsc を通す、既存 Publish との互換性 | 
| **Phase 2B — Manifest & API 刷新** | 2025-11-04〜2025-11-22 | `GET /v1/manifest` 実装、`POST /v1/rounds/start`/`next` の条件対応、JWS 署名ライブラリ導入、MSW/Playwright モック更新 | Phase 2A のメタデータ投入、フロントから叩けるサンプル条件 | 
| **Phase 2C — フロントエンド適用** | 2025-11-25〜2025-12-13 | モード/フィルタ選択 UI、ラウンド開始時の条件送信、結果画面で条件を表示、`NEXT_PUBLIC_API_MOCK` との整合 | Phase 2B API、i18n 文言、デザイン合意 | 
| **Phase 2D — 品質と運用** | 2025-12-16〜2026-01-10 | E2E テスト拡張、メトリクス整備、Cron によるプリセット（日替わり）再実装、R2 キャッシュ方針策定、運用 Runbook 更新 | Phase 2A〜C 完了、Cloudflare 環境の Secrets 設定 |

> 期間は 2025-10-13 時点の暫定値。後続の優先度調整や工数見積もりで改訂する。

## 3. 詳細タスク

### Phase 2A — データ整備

- `workers/data/curated.json` に難易度 (`difficulty`), ジャンル (`genres`), シリーズ (`seriesTags` など) を追加。
- D1 スキーマ拡張：`workers/migrations` に `track_facets`（track_id, facet, value）などの正規化テーブルを追加。必要に応じてビューを用意。
- Publish ステージの出力 (`DailyExport.reveal/meta`) を新メタデータに合わせて拡張。
- `npm run validate:curated` を更新し、新フィールドをバリデーション対象にする。
- ドキュメント更新：`docs/backend/curated-data-format.md` に新フィールドを追記、例と JSON Schema を更新。

### Phase 2B — Manifest & API 刷新

- `GET /v1/manifest` 実装：
  - 有効モード（例: `vgm_v1-ja`, `vgm_archive`）
  - ファセット一覧（`difficulty`, `genre`, `series`, `era` 等）
  - 機能フラグ（例: `supportsArchivePlay`, `supportsSeed`）
- `POST /v1/rounds/start` に以下を実装：
  - Request Body: `{ mode, filters, total, seed }`
  - 条件にマッチするトラックから N 件サンプリング（重複禁止、seed 対応）
  - 生成した問題 ID と条件を JWS にエンコードし返却
- `POST /v1/rounds/next` を JWS デコード方式に差し替え、トークン内 `mode/filters` を用いて継続。
- Phase 1 互換の暫定 `GET /v1/rounds/start` は `/v1/rounds/start?legacy=1` のようなガードや Reverse Proxy で一時的に保持する（最終的に削除予定）。
- MSW／Playwright：Manifest 取得と新 API 形状に合わせたモックデータを提供。
- ドキュメント更新：`docs/api/api-spec.md` を最新仕様へ昇格（Draft → Approved 更新）。

### Phase 2C — フロントエンド適用

- `/play` にモード選択 UI を追加（初期案: 「日替わり」「ランダム」「難易度別」「ジャンル別」タブ）。
- Manifest をアプリ起動時にフェッチし、`React Query` などでキャッシュ。MSW モードでも manifest JSON を返す。
- `start()` 呼び出しを `POST` 化し、条件を送信。FIN: `useAnswerProcessor` と結果画面に条件を表示。
- ランディング／ドキュメント (`docs/frontend/play-flow.md`) を更新し、新しいフローを図示。
- i18n 文言追加。`locales/ja/common.json` 等にモード説明を追加。

### Phase 2D — 品質と運用

- テスト: Playwright に「条件別プレイ」シナリオを追加、Vitest で Manifest 契約テストを導入。
- メトリクス: `POST /v1/metrics` にモード・フィルタのメタ情報を添付し、分析基盤で区別可能にする。
- 運用: Cron で日替わりプリセット（`mode=daily`, 固定 filters）を生成し R2 に書き出しつつ、オンデマンド要求では API が直接サンプリングする。
- Runbook / SOP: `docs/ops` 配下にストック更新手順、Manifest 更新時の注意点、Fallback（データ不足時のユーザー通知）を追記。

## 4. 決定事項と非目標

- Manifest＋Conditioned Rounds が Phase 2 の中心タスク。日替わり専用 API への追加投資は行わない。
- Phase 2 ではリアルタイム音源（ストリーミング API 連携）は扱わない。音源取得は Phase 3 プラン（別途策定予定）。
- モバイルアプリやマルチプレイなどのスコープ外機能はロードマップに含めない。必要なら別ドキュメントで検討。

## 5. リスクと対策

- **データ充足**: ファセットごとに十分な問題数が無いと条件サンプリングが失敗する。対策として `POST /v1/availability` を実装し、UI で不足を明示する。
- **JWS 実装コスト**: Phase 1 の Base64 トークンから JWS への切り替えはフロント・バックで同時に進める必要あり。まずは共有ライブラリ（`workers/shared/lib/token.ts`）を抽象化し、MSW でも同じ署名ロジックを再利用する。
- **移行期間の二重仕様**: Legacy `GET` を残す期間は短くし、Feature Flag によるロールアウト計画を `docs/dev/backlog-plan` に追記する。
- **Cron とオンデマンドの整合**: Publish が R2 と D1 の整合性を保てない場合があるため、Phase 2D で監視（STORAGE head, D1 picks）と自動補正ジョブを入れる。

## 6. 次のアクション（2025-10-13 時点）

1. **バックログ化** — 上記タスクを Issue 化し、優先順位と担当を決める。
2. **データ項目定義** — Phase 2A に向けた難易度・ジャンルの定義一覧を `docs/data` に追記する。
3. **Manifest の再レビュー** — `docs/api/api-spec.md` の Manifest セクションを最新ニーズ（ストック型）に合わせて調整し、PR で合意形成する。
4. **UX プロトタイプ** — フィルタ選択画面のワイヤーフレームを `docs/design` へ追加し、Phase 2C に備える。

---

> 編集ログ: 2025-10-13 Codex 作成。今後の変更は本ファイルの冒頭 `Last Updated` を更新し、関連 Issue/PR から参照すること。

# KPI 指標定義 (Phase 3C)

**ステータス**: Phase 3C 初版
**対象バージョン**: Phase 2B 以降
**最終更新**: 2025-11-16

---

## 目的

週間 KPI の定義を文書化し、ビジネス・技術チーム全体で同じ指標言語を共有する。各 KPI は「何を測るか」「なぜ測るか」「いつ正常か」を明示し、ダッシュボード実装とアラート閾値設定の基盤となる。

---

## KPI 一覧

| 指標 | カテゴリ | 対象 | 目標 | 計測対象イベント |
|------|---------|------|------|-----------------|
| [Completion Rate](#completion-rate--完走率) | Core Engagement | Quiz Session | > 80% | `quiz_complete` |
| [Outbound Rate](#outbound-rate--外部遷移率) | User Behavior | Reveal View | 参考指標 | `reveal_open_external` |
| [Embed Fallback Rate](#embed-fallback-rate--埋め込み失敗率) | Playback Quality | Reveal View | < 5% | `embed_fallback_to_link` |
| [Embed Load Error Rate](#embed-load-error-rate--読み込みエラー率) | Playback Quality | Embed Attempt | < 2% | `embed_error` |

---

## Core Engagement Metrics

### Completion Rate — 完走率

**定義**: ユーザーがクイズを開始してから、最後の問題に回答するまで完走した割合。

**ビジネス目的**
- アプリの粘着性を測る（ユーザーが途中で離脱していないか）
- UI 改善による離脱削減の効果測定

**計算式**
```
Completion Rate = quiz_complete イベント数 / (round/start API コール数 - エラー) × 100%
```

**詳細**

| 項目 | 値 |
|------|-----|
| 分子 | `quiz_complete` イベント数 |
| 分母 | `/v1/rounds/start` レスポンス成功件数 |
| 集計粒度 | 日次、フィルタ別（difficulty/era/series）|
| 計測期間 | 7 日（週次レビュー） |

**分子の定義**
- イベント: `quiz_complete`
- 発火タイミング: `/v1/rounds/next` で最後の問題に対する回答が返された時点
- 属性: `roundId`, `attrs.total`, `attrs.points`, `attrs.correct`, `attrs.wrong`, `attrs.skip`, `attrs.timeout`, `attrs.durationMs`
- ユーザーセッション追跡: `roundId` + `clientId` で join

**分母の定義**
- API: `POST /v1/rounds/start` の成功レスポンス（HTTP 200）
- フィルタ別計測: リクエスト body の `filters` パラメータで groupby

**目標値と閾値**

| 基準 | 値 | 対応 |
|-----|-----|------|
| 目標 | > 80% | ユーザー粘着性が十分 |
| 警告 | 70～80% | 離脱が増加：UI/UX 確認 |
| アラート | < 70% | 緊急：エラーログ確認、即座に対応 |

**ダッシュボード表示**
- 日別折線グラフ（7 日間）
- フィルタ別の内訳（積み上げ棒グラフ）
- 前週比 % 表示

---

## User Behavior Metrics

### Outbound Rate — 外部遷移率

**定義**: Reveal 画面でユーザーが「YouTube/Spotify で開く」ボタンをクリックした割合。

**ビジネス目的**
- ユーザーが埋め込みプレイヤーを経由してではなく、外部サービスで曲を聴いている行動を捕捉
- インライン再生設定やプロバイダ別の人気度を測る

**計算式**
```
Outbound Rate = reveal_open_external イベント数 / answer_result イベント数 × 100%
```

**詳細**

| 項目 | 値 |
|------|-----|
| 分子 | `reveal_open_external` イベント数 |
| 分母 | 質問あたりの reveal 表示回数の代理: `answer_result` イベント数（= 1 問ごとに必ず送信される） |
| 集計粒度 | 日次、プロバイダ別（youtube/spotify/appleMusic/other） |
| 計測期間 | 7 日（週次レビュー） |

**分子の定義**
- イベント: `reveal_open_external`
- 発火タイミング: ユーザーが「Open in X」リンクをクリック
- 属性: `roundId`, `questionIdx`, `attrs.provider`

**分母の定義**
- イベント: `answer_result`（各問題で 1 回必ず送信され、直後に Reveal が表示されるため per-question 代理として使用）
- 集計: `COUNT(DISTINCT round_id || ':' || question_idx)`
- 留意: ユーザーがインライン再生を無効にしていても Reveal は表示されるため、この代理は過小計測になりにくい。

**参考指標の意味**
- > 80%: ユーザーの大多数が外部サービスを活用（正常な利用パターン）
- 50～80%: 埋め込みと外部リンクが混在（インライン再生が有効/無効が混在）
- < 50%: インライン再生が活発で埋め込み成功率が高い（プレイヤー品質が良好）

**ダッシュボード表示**
- プロバイダ別積み上げ棒グラフ
- 日別トレンド（参考値）
- 注釈: 「参考指標のため、単独では問題判定しない」

---

## Playback Quality Metrics

### Embed Fallback Rate — 埋め込み失敗率（URL 変換失敗）

**定義**: YouTube 埋め込みが試行されたが、URL が埋め込み可能形式に変換できず、ユーザーに リンク fallback が強制された割合。

**ビジネス目的**
- ソースデータ品質（curated.json の URL 正確性）を測る
- 修正優先度の判定（数値が高い = 多くのトラックが不正な URL を持つ）

**計算式**
```
Embed Fallback Rate = embed_fallback_to_link イベント数 / answer_result イベント数 × 100%
```

**詳細**

| 項目 | 値 |
|------|-----|
| 分子 | `embed_fallback_to_link` イベント数（reason = 'no_embed_available'） |
| 分母 | インライン再生が有効だった Reveal 回数: `answer_result` (attrs.inlineEnabled = true) |
| 集計粒度 | 日次、提供元別（provider: youtube/spotify/appleMusic） |
| 計測期間 | 7 日（週次レビュー） |

**分子の定義**
- イベント: `embed_fallback_to_link`
- 発火条件: インライン再生有効 + URL を `toYouTubeEmbed()` で変換できない
- 属性: `roundId`, `questionIdx`, `attrs.questionId`, `attrs.provider`, `attrs.reason: 'no_embed_available'`
- 原因: URL が youtube.com/watch?v=<ID> または youtu.be/<ID> 形式でない、または URL パース失敗

**分母の定義**
- イベント: `answer_result`
- フィルタ: `attrs.inlineEnabled = true`（インライン再生 ON の設問のみ）
- 集計: `COUNT(DISTINCT round_id || ':' || question_idx)`

**目標値と閾値**

| 基準 | 値 | 対応 |
|-----|-----|------|
| 目標 | < 5% | ソースデータ品質が十分 |
| 警告 | 5～10% | データ修正案件あり：curated.json URL 再検証 |
| アラート | > 10% | 深刻な品質問題：緊急データ修正、検証テスト追加 |

**ダッシュボード表示**
- 日別折線グラフ（7 日間）
- 問題のある questionId トップ 10（再発防止）
- 修正予定日との連携（JIRA チケット）

---

### Embed Load Error Rate — 読み込みエラー率

**定義**: 埋め込みプレイヤーフレーム（iframe）が設定されたが、読み込み時に onError イベントが発火した割合。

**現在の実装**: YouTube プロバイダのみ対応。他プロバイダ（Spotify、Apple Music など）が埋め込み対応される場合、attrs.provider ごとに分析。

**ビジネス目的**
- コンテンツ提供プラットフォーム（YouTube など）の可用性（削除/非公開/年齢制限など）を測る
- 定期的な外部リンク監視の優先順位を決める

**計算式**
```
Embed Load Error Rate = embed_error イベント数 / (embed_attempt 数) × 100%
```

**詳細**

| 項目 | 値 |
|------|-----|
| 分子 | `embed_error` イベント数（reason = 'load_error'） |
| 分母 | インライン再生 ON の埋め込み試行数（= inlineEnabled `answer_result` 数 - fallback 数）|
| 集計粒度 | 日次、ジャンル別・難易度別（メタデータ join） |
| 計測期間 | 7 日（週次レビュー） |

**分子の定義**
- イベント: `embed_error`
- 発火条件: iframe.onError が発火
- 属性: `roundId`, `questionIdx`, `attrs.questionId`, `attrs.provider: 'youtube'`, `attrs.reason: 'load_error'`
- 原因: 動画削除、非公開化、年齢制限、地域制限、ネットワークエラーなど

**分母の定義**
- **Embed Attempt**: `answer_result` (attrs.inlineEnabled = true) から `embed_fallback_to_link` を差し引いた値
  - フィルタ: `attrs.inlineEnabled = true`
  - 集計: `COUNT(DISTINCT round_id || ':' || question_idx)` をベースに計算

**目標値と閾値**

| 基準 | 値 | 対応 |
|-----|-----|------|
| 目標 | < 2% | YouTube 動画の可用性が十分 |
| 警告 | 2～3% | 月次で監視対象リスト作成 |
| アラート | > 3% | 緊急：YouTube リンク大量削除/制限の可能性、即座に影響トラック確認 |

**ダッシュボード表示**
- 日別折線グラフ（7 日間）
- エラーが発生した questionId リスト（削除候補）
- 修正完了までのカウントダウン（SLA）

---

## メトリクス間の関係図

```
Reveal View (分母)
  ├─ embed_fallback_to_link (埋め込み失敗)
  │   └─ → ユーザーにリンク fallback が表示
  ├─ embed_error (読み込み失敗)
  │   └─ → ユーザーにリンク fallback が表示
  └─ (埋め込み成功)
      └─ reveal_open_external (一部ユーザーが外部クリック)

quiz_complete (完走)
  └─ quiz_complete × Completion Rate
```

---

## 計測の実装責任

| 指標 | 計測側 | 確認方法 |
|------|--------|--------|
| Completion Rate | FE (RevealCard, useAnswerProcessor) | quiz_complete イベント在無 |
| Outbound Rate | FE (RevealCard.handleExternalClick) | reveal_open_external イベント在無 |
| Embed Fallback Rate | FE (RevealCard useEffect) | embed_fallback_to_link イベント在無 |
| Embed Load Error Rate | FE (RevealCard.handleEmbedError) | embed_error イベント在無 |

**バックエンド責務**
- `/v1/metrics` で全イベントを受け入れ、検証、D1 永続化
- イベント日時・クライアント ID・属性の完全性を確保
- 集計クエリを Grafana で実装

---

## ダッシュボード実装チェックリスト

- [ ] Grafana Loki + Prometheus 設定完了
- [ ] 日次イベント抽出 SQL / ETL パイプライン確立
- [ ] Completion Rate 板 / グラフ作成
- [ ] Outbound Rate 板 / グラフ作成（参考指標としてマーク）
- [ ] Embed Fallback Rate 板 / グラフ作成
- [ ] Embed Load Error Rate 板 / グラフ作成
- [ ] Slack アラート統合（閾値超過時に #vgm-ops へ通知）
- [ ] 週次レビュー議事録テンプレート用意

---

## 今後の拡張（Phase 4+）

- Score Distribution（正解率別の分布）
- Filter Effectiveness（フィルタ別完走率）
- Time to Completion（セッション継続時間）
- Provider Preference（ユーザーが選ぶプロバイダの嗜好）
- A/B Test Metrics（UI 改善の効果測定）

---

## 関連ドキュメント

- [quality/measurement-plan.md](measurement-plan.md) - イベント→指標マッピングと計測フロー
- [ops/runbooks/audio-playback.md](../ops/runbooks/audio-playback.md) - Embed 失敗時の初動対応
- [api/api-spec.md](../api/api-spec.md#post-v1metrics) - /v1/metrics エンドポイント仕様
- [frontend/metrics-client.md](../frontend/metrics-client.md) - メトリクスクライアント実装

---

## 変更履歴

- **2025-11-16**: Phase 3C 初版作成（Issue #32）

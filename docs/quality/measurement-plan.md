# 計測設計・イベント→指標マッピング (Phase 3C)

**ステータス**: Phase 3C 初版
**対象バージョン**: Phase 2B 以降
**最終更新**: 2025-11-16

---

## 目的

「どこでどのイベントを送るか」「どのイベントがどの指標に使われるか」を図解し、**計測漏れ防止**と**集計 SQL の仕様書**として機能させる。

---

## イベント一覧と送信ポイント

| イベント | 送信元コンポーネント | 発火条件 | 属性 | 指標への使用 |
|---------|------------------|--------|------|-----------|
| `quiz_complete` | [useAnswerProcessor.ts](../../web/src/features/quiz/useAnswerProcessor.ts) | 最後の問題に回答した時点 | roundId, attrs{total, points, correct, wrong, timeout, skip, durationMs} | Completion Rate 分子 |
| `reveal_open_external` | [RevealCard.tsx](../../web/src/components/RevealCard.tsx) | ユーザーが「Open in X」をクリック | roundId, questionIdx, attrs{questionId, provider} | Outbound Rate 分子 |
| `embed_fallback_to_link` | [RevealCard.tsx](../../web/src/components/RevealCard.tsx) | インライン再生有効 + URL 変換失敗 | roundId, questionIdx, attrs{questionId, provider, reason: 'no_embed_available'} | Embed Fallback Rate 分子 |
| `embed_error` | [RevealCard.tsx](../../web/src/components/RevealCard.tsx) | iframe.onError 発火 | roundId, questionIdx, attrs{questionId, provider, reason: 'load_error'} | Embed Load Error Rate 分子 |

---

## 計測フロー図

```
┌─────────────────────────────────────────────────────────────┐
│                   User Quiz Session                         │
│                    roundId = UUID                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  POST /v1/rounds/start              │
        │  ├─ filters: {difficulty?, era?}    │
        │  ├─ total: 10                       │
        │  └─ Response: {round.token, q1}     │
        └─────────────────────────────────────┘
         ★ Completion Rate 分母カウント ★
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  [1] Question Presented             │
        │  └─ display_time: 15秒 (固定)      │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  [2] User Select Choice             │
        │  └─ trigger: answer_select event    │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  [3] Submit Answer or Timeout       │
        │  └─ POST /v1/rounds/next {token}    │
        │     ├─ Response: {reveal, next?}    │
        │     └─ Sent: answer_result event    │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  [4] Reveal Display (RevealCard)    │
        │  ├─ show meta (composer, game)      │
        │  ├─ try embed (YouTube)             │
        │  └─ show external link              │
        └─────────────────────────────────────┘
                    ↙         ↓         ↖
         embed     fallback  success   error
         不可能      不可      再生     失敗
            │          │        │       │
            ▼          ▼        ▼       ▼
        [EVENT]   [EVENT]   [UI]    [EVENT]
        fallback   fallback  only    error
        to_link    to_link   link   on iframe
            │          │        │       │
            └─ fallback ────────┘       │
                  │                     │
                  └──── or click ◄──────┘
                         external
                         link
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  [FALLBACK] reveal_open_external    │
        │  └─ attrs: {provider: 'youtube'}    │
        └─────────────────────────────────────┘
                          │
                  ┌───────┴───────┐
                  ▼               ▼
            (外部サイト)    (ユーザー戻る)
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  [5] Next or Finish                 │
        │  ├─ if finished:                    │
        │  │   └─ quiz_complete ★             │
        │  └─ if next:                        │
        │      └─ → back to [1]              │
        └─────────────────────────────────────┘
```

---

## イベント詳細仕様と計測ロジック

### 1. quiz_complete イベント

**発火ポイント**: `useAnswerProcessor.ts` の `handleFinish()` →フロントエンド最終状態

```typescript
// 送信タイミング
if (res.finished === true) {
  recordMetricsEvent('quiz_complete', {
    roundId: continuationToken,
    attrs: {
      total: totalQuestions,
      points: updatedTally.points,
      correct: updatedTally.correct,
      wrong: updatedTally.wrong,
      timeout: updatedTally.timeout,
      skip: updatedTally.skip,
      durationMs,
    },
  })
}
```

**属性定義**

| 属性 | 型 | 例 | 用途 |
|------|-----|-----|------|
| roundId | string | "550e8400-e29b-41d4-a716-446655440000" | セッション特定 |
| attrs.total | number | 10 | 総問題数 |
| attrs.points | number | 850 | 合計スコア |
| attrs.correct | number | 7 | 正解数 |
| attrs.wrong | number | 2 | 不正解数 |
| attrs.skip | number | 1 | スキップ数 |
| attrs.timeout | number | 0 | タイムアウト数 |
| attrs.durationMs | number | 142000 | セッション総所要時間（ミリ秒） |

**集計ロジック（SQL 例）**

```sql
-- Completion Rate = Complete / Started × 100% (D1/SQLite)
SELECT
  DATE(ts) as date,
  COUNT(DISTINCT CASE WHEN event_name = 'quiz_complete' THEN round_id END) as completed,
  COUNT(DISTINCT round_id) as started,
  ROUND(
    COUNT(DISTINCT CASE WHEN event_name = 'quiz_complete' THEN round_id END)
    * 100.0 / COUNT(DISTINCT round_id),
    2
  ) as completion_rate_pct
FROM metrics_events
WHERE event_name IN ('quiz_complete', 'answer_result')
GROUP BY DATE(ts)
ORDER BY date DESC;
```

**再送条件**
- 送信失敗時: localStorage キューに格納、指数バックオフで最大 5 回まで再試行
  - BASE_RETRY_MS=2000ms、RETRY_JITTER_RATIO=0.25
  - 再試行間隔: 2s, 4s, 8s, 16s, 32s (jitter ±25%)
- 重複防止: `roundId` で冪等性確保（questionIdx は quiz_complete には含まれないため）

---

### 2. reveal_open_external イベント

**発火ポイント**: `RevealCard.tsx` の `handleExternalClick()` → ユーザーアクション

```typescript
// 送信タイミング
const handleExternalClick = useCallback(() => {
  if (!primary) return;
  recordMetricsEvent('reveal_open_external', {
    roundId: telemetry?.roundId,
    questionIdx: telemetry?.questionIdx,
    attrs: {
      questionId: telemetry?.questionId,
      provider: primary.provider,
    },
  });
}, [primary, telemetry?.roundId, telemetry?.questionIdx, telemetry?.questionId]);
```

**属性定義**

| 属性 | 型 | 例 | 用途 |
|------|-----|-----|------|
| roundId | string | "550e8400-..." | セッション特定 |
| questionIdx | number | 3 | 問題位置 |
| attrs.questionId | string | "q-001" | トラック特定 |
| attrs.provider | string | "youtube" | プロバイダ別集計 |

**集計ロジック（SQL 例）**

```sql
-- Outbound Rate = External Clicks / Answer Results × 100% (D1/SQLite)
-- answer_result は各設問で必ず 1 回送信されるため、reveal 表示の代理指標とする
WITH answered AS (
  SELECT
    DATE(ts) as date,
    COUNT(DISTINCT round_id || ':' || COALESCE(question_idx, '')) as total_answered
  FROM metrics_events
  WHERE event_name = 'answer_result'
  GROUP BY DATE(ts)
),
outbound AS (
  SELECT
    DATE(ts) as date,
    COUNT(*) as external_clicks
  FROM metrics_events
  WHERE event_name = 'reveal_open_external'
  GROUP BY DATE(ts)
)
SELECT
  a.date,
  a.total_answered,
  COALESCE(o.external_clicks, 0) as external_clicks,
  ROUND(
    COALESCE(o.external_clicks, 0) * 100.0 / NULLIF(a.total_answered, 0),
    2
  ) as outbound_rate_pct
FROM answered a
LEFT JOIN outbound o ON a.date = o.date
ORDER BY a.date DESC;
```

**再送条件**
- 送信失敗時: localStorage キューに格納、指数バックオフで最大 5 回まで再試行
- 欠損時の扱い: クリック回数ゼロは「ユーザーが外部リンク未利用」で正常

---

### 3. embed_fallback_to_link イベント

**発火ポイント**: `RevealCard.tsx` の useEffect → コンポーネント初期化時

```typescript
// 送信タイミング
React.useEffect(() => {
  if (!inline) return; // インライン再生無効なら送信しない
  if (!primary) return;
  if (embedUrl) return; // 埋め込み可能なら送信しない
  if (fallbackLogged) return; // 重複送信防止

  recordMetricsEvent('embed_fallback_to_link', {
    roundId: telemetry?.roundId,
    questionIdx: telemetry?.questionIdx,
    attrs: {
      questionId: telemetry?.questionId,
      provider: primary.provider,
      reason: 'no_embed_available',
    },
  });
  setFallbackLogged(true);
}, [inline, primary, embedUrl, fallbackLogged, ...deps]);
```

**属性定義**

| 属性 | 型 | 値 | 用途 |
|------|-----|-----|------|
| roundId | string | "550e8400-..." | セッション特定 |
| questionIdx | number | 5 | 問題位置 |
| attrs.questionId | string | "q-025" | トラック特定 |
| attrs.provider | string | "youtube" | プロバイダ |
| attrs.reason | string | "no_embed_available" | 原因分類（定数） |

**送信条件の詳細**
- インライン再生が有効（localStorage `vgm2.settings.inlinePlayback = 1`）
- URL が `toYouTubeEmbed()` で埋め込み URL に変換できない
- 同じ question に対して 1 回のみ送信（`fallbackLogged` フラグで制御）

**集計ロジック（SQL 例）**

```sql
-- Embed Fallback Rate = Fallback Events / Total Reveals × 100% (D1/SQLite)
WITH reveals AS (
  SELECT
    DATE(ts) as date,
    COUNT(DISTINCT round_id || ':' || COALESCE(question_idx, '')) as total_reveals
  FROM metrics_events
  WHERE event_name IN (
    'quiz_complete', 'embed_error', 'embed_fallback_to_link'
  )
  GROUP BY DATE(ts)
),
fallback AS (
  SELECT
    DATE(ts) as date,
    COUNT(*) as fallback_events
  FROM metrics_events
  WHERE event_name = 'embed_fallback_to_link'
    AND json_extract(attrs, '$.reason') = 'no_embed_available'
  GROUP BY DATE(ts)
)
SELECT
  r.date,
  r.total_reveals,
  COALESCE(f.fallback_events, 0) as fallback_events,
  ROUND(
    COALESCE(f.fallback_events, 0) * 100.0 / r.total_reveals,
    2
  ) as fallback_rate_pct
FROM reveals r
LEFT JOIN fallback f ON r.date = f.date
ORDER BY r.date DESC;
```

**再送条件**
- 送信失敗時: localStorage キューに格納、指数バックオフで最大 5 回まで再試行
- 計測漏れ時: 「この reveal に対して fallback イベントなし」 = 埋め込み成功と推定

---

### 4. embed_error イベント

**発火ポイント**: `RevealCard.tsx` の `handleEmbedError()` → iframe.onError コールバック

```typescript
// 送信タイミング
const handleEmbedError = useCallback(() => {
  if (errorLogged || !primary) return;
  setErrorLogged(true);

  recordMetricsEvent('embed_error', {
    roundId: telemetry?.roundId,
    questionIdx: telemetry?.questionIdx,
    attrs: {
      questionId: telemetry?.questionId,
      provider: primary.provider,
      reason: 'load_error',
    },
  });
}, [errorLogged, primary, telemetry?.roundId, telemetry?.questionIdx, telemetry?.questionId]);
```

**属性定義**

| 属性 | 型 | 値 | 用途 |
|------|-----|-----|------|
| roundId | string | "550e8400-..." | セッション特定 |
| questionIdx | number | 7 | 問題位置 |
| attrs.questionId | string | "q-042" | トラック特定 |
| attrs.provider | string | "youtube" | プロバイダ |
| attrs.reason | string | "load_error" | エラー原因（定数） |

**発火条件の詳細**
- 埋め込み URL は有効（`toYouTubeEmbed()` 成功）
- iframe が作成され、src が設定された
- iframe.onError がブラウザで発火（動画削除、年齢制限、地域制限、network エラーなど）
- 同じ question に対して 1 回のみ送信（`errorLogged` フラグで制御）

**集計ロジック（SQL 例）**

```sql
-- Embed Load Error Rate = Error Events / Embed Attempts × 100% (D1/SQLite)
-- Embed Attempts ≒ answer_result（全設問）から「埋め込み不可だった質問」を差し引いた値
WITH answered AS (
  SELECT
    DATE(ts) as date,
    COUNT(DISTINCT round_id || ':' || COALESCE(question_idx, '')) as total_answered
  FROM metrics_events
  WHERE event_name = 'answer_result'
  GROUP BY DATE(ts)
),
fallback AS (
  SELECT
    DATE(ts) as date,
    COUNT(DISTINCT round_id || ':' || COALESCE(question_idx, '')) as fallback_count
  FROM metrics_events
  WHERE event_name = 'embed_fallback_to_link'
  GROUP BY DATE(ts)
),
errors AS (
  SELECT
    DATE(ts) as date,
    COUNT(*) as error_count
  FROM metrics_events
  WHERE event_name = 'embed_error'
    AND json_extract(attrs, '$.reason') = 'load_error'
  GROUP BY DATE(ts)
)
SELECT
  a.date,
  (a.total_answered - COALESCE(f.fallback_count, 0)) as embed_attempts,
  COALESCE(e.error_count, 0) as error_events,
  ROUND(
    COALESCE(e.error_count, 0) * 100.0
    / NULLIF(a.total_answered - COALESCE(f.fallback_count, 0), 0),
    2
  ) as error_rate_pct
FROM answered a
LEFT JOIN fallback f ON a.date = f.date
LEFT JOIN errors e ON a.date = e.date
ORDER BY a.date DESC;
```

**再送条件**
- 送信失敗時: localStorage キューに格納、指数バックオフで最大 5 回まで再試行
- ネットワーク遅延時: iframe.onError は即座に発火するため、タイムアウト問題は通常なし

---

## 計測チェックリスト（実装時）

### フロントエンド

- [ ] `quiz_complete` イベント実装
  - [ ] roundId 取得可能か確認
  - [ ] total, points, correct, wrong, skip, timeout, durationMs 計算正確か
  - [ ] 最後の問題のみ送信されるか確認
  - [ ] questionIdx は含まれないことを確認（セッション全体の集計のため）

- [ ] `reveal_open_external` イベント実装
  - [ ] ユーザーリンククリック時のみ送信
  - [ ] questionId, provider 属性が正確か

- [ ] `embed_fallback_to_link` イベント実装
  - [ ] インライン再生有効時のみ送信
  - [ ] URL 変換失敗時のみ送信
  - [ ] 同じ question への重複送信なし（fallbackLogged フラグ）

- [ ] `embed_error` イベント実装
  - [ ] iframe.onError 時のみ送信
  - [ ] 同じ question への重複送信なし（errorLogged フラグ）

### バックエンド

- [ ] `/v1/metrics` エンドポイント動作確認
  - [ ] 全 4 イベント名がホワイトリストに登録
  - [ ] 属性検証ロジック完全か
  - [ ] D1 永続化成功か

- [ ] イベント重複排除
  - [ ] idempotencyKey による冪等性確保
  - [ ] 同一イベント 2 回受信時の挙動

### 計測・集計

- [ ] Grafana / Loki ダッシュボード実装
  - [ ] 上記 SQL クエリをプリセットに登録
  - [ ] 日別グラフが 7 日分表示
  - [ ] フィルタ別内訳（difficulty/era/provider）も表示可能か

---

## イベント欠損時の扱い

| シナリオ | イベント | 推定方法 | 正確性 |
|--------|---------|--------|------|
| `quiz_complete` なし | ユーザーが途中離脱 | `/v1/rounds/start` - `quiz_complete` = 未完走 | 高 |
| `reveal_open_external` なし | ユーザーが外部クリックしない | 0 イベント = 埋め込みのみ利用 | 高 |
| `embed_fallback_to_link` なし + embed_error なし | 埋め込み成功 | Reveal view - fallback - error = 成功 | 中 |
| `embed_error` なし | iframe は read only | Unknown - ブラウザが onError を発火しないケースもあり | 低 |

**影響**: Embed Load Error Rate 計算時、分母の iframe.onError カウント が低めに出る可能性あり。定期的に manual spot check で検証。

---

## 環境別の注意

### ローカル開発（MSW モック）

- MSW ハンドラが `/v1/metrics` リクエストを受け取り、localStorage に蓄積
- ダッシュボード不可（本番環境で初めて動作）
- イベント列をコンソール / DevTools で目視確認

### ステージング / 本番

- リアルな `/v1/metrics` エンドポイントへ送信
- Grafana Cloud Loki に 24h ロールアップ
- アラート自動トリガー設定

---

## 関連ドキュメント

- [quality/metrics.md](metrics.md) - KPI 指標定義
- [api/api-spec.md#post-v1metrics](../api/api-spec.md#post-v1metrics) - /v1/metrics エンドポイント仕様
- [ops/runbooks/audio-playback.md](../ops/runbooks/audio-playback.md) - Embed 失敗時の初動対応
- [frontend/metrics-client.md](../frontend/metrics-client.md) - メトリクスクライアント実装

---

## 変更履歴

- **2025-11-16**: Phase 3C 初版作成（Issue #33）

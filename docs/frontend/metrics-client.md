# Metrics Client & Event Vocabulary

- Status: Draft
- Last Updated: 2025-09-27

## 目的
FE-07 で実装したメトリクス送信機構（バッチ・冪等・バックオフ）の仕様をまとめ、BE 連携やテストの基礎資料にする。

---

## 1. 全体像
- **キュー管理**: `web/src/lib/metrics/metricsClient.ts` がシングルトンで動作。`localStorage` に `vgm2.metrics.queue` を保存し、タブを跨いだ再送に対応。
- **イベント記録**: `recordMetricsEvent(name, options)` を呼び出すと即時にキューへ追加。`MAX_QUEUE_SIZE=200` を超える場合は古い物から破棄。
- **送信トリガー**: 
  - キュー追加時／起動時に即時 flush を試みる。
  - `visibilitychange:hidden`、`pagehide` で `sendBeacon` を利用。
  - `online` イベントで再送をスケジュール。
- **バッチ化**: `FLUSH_BATCH_SIZE = 20`。1リクエストあたり最大20イベントを `POST /v1/metrics` へ投げる。

---

## 2. 冪等とバックオフ
- 各イベントには UUIDv4 の `id` を付与。
- リクエスト単位で `idempotencyKey` を生成し、再送時も同一ボディを使用。
- 失敗時のリトライ: 指数バックオフ（基準 2,000ms）＋ ±25% のジッタ。`MAX_RETRY_COUNT = 5` を超えると破棄。
- `429` の場合は `Retry-After` ヘッダを優先。

---

## 3. イベント語彙（MVP）
| name | 発火箇所 | attrs |
| --- | --- | --- |
| `quiz_start` | `/play` ラウンド開始成功時 | `mode`, `arm`, `total` |
| `answer_select` | `/play` の選択ボタン | `questionId`, `choiceId`, `choiceLabel` |
| `answer_result` | 回答確定（正誤判定直後） | `questionId`, `outcome`, `points`, `remainingSeconds`, `choiceId`, `correctChoiceId`, `elapsedMs`, `mode`, `arm` |
| `quiz_complete` | ラウンド完走時 | `mode`, `arm`, `total`, `points`, `correct`, `wrong`, `timeout`, `skip`, `durationMs` |
| `quiz_revisit` | 結果ページ表示時 | `mode`, `arm`, `total`, `correct`, `wrong`, `timeout`, `skip`, `durationMs` |
| `reveal_open_external` | Reveal の外部リンク押下 | `questionId`, `provider` |
| `embed_error` | インライン埋め込み iframe の onError | `questionId`, `provider`, `reason` |
| `embed_fallback_to_link` | インライン再生不可→リンク表示に切り替えたとき | `questionId`, `provider`, `reason` |
| `settings_inline_toggle` | インライン再生トグル | `enabled` |

> `round_id` にはクライアントが保持しているラウンドトークンをそのまま設定。`question_idx` は 1 始まりで `/play` 側の Progress と同期。

---

## 4. テスト手順のメモ
1. DevTools Network タブの `v1/metrics` を監視。
2. オンライン・オフライン切り替えでキュー挙動を確認。
3. `Application > Local Storage` で `vgm2.metrics.queue` をチェック。
4. イベント payload の `attrs` が仕様通りかを比較。
5. 破壊的変更チェック: `cd web && npm run test:unit -- tests/unit/metricsClient.contract.spec.ts tests/unit/reveal.contract.spec.ts` を実行し、Zod スキーマでメトリクス/Reveal payload を検証する。

---

## 5. 今後の課題
- 実 BE 環境での `Idempotency-Key` サポート有無を確認。
- `artwork_open` など未使用語彙の扱い（必要になったら実装）。
- PII 許容ポリシーの明文化（現在は送信していない）。

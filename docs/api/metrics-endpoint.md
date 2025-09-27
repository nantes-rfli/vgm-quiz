# Metrics Ingest API — 最小仕様
- Status: Approved
- Last Updated: 2025-09-22

本書はクライアントからの計測イベント投入 I/F（MVP）を定義します。**サーバは受領・整形・蓄積のみ**を行い、同期集計は行いません。エラー語彙は別紙「API Error Model — 最小仕様」を参照。

- エンドポイント: `POST /v1/metrics`
- 認証: **なし（MVP）** — CORS の **Origin allowlist** とレート制限で保護。将来 API Key を導入可。
- 圧縮: `Content-Encoding: gzip` を受理（任意）。
- ボディ上限: **256 KB**
- バッチ上限: **100 イベント/リクエスト**
- 冪等: `events[].id`（UUIDv4）で **24h** 窓の重複排除。  
  追加で `Idempotency-Key`（ヘッダ, 任意）: **同一キー+同一ボディ** は同結果を返す。

## リクエスト（JSON）
```json
{
  "client": {
    "client_id": "c0b9b2dc-...-c2f",   // 端末内匿名ID（UUID推奨）
    "app_version": "0.1.0",
    "tz": "+09:00"
  },
  "events": [
    {
      "id": "f2b6e4aa-...-3d7",
      "name": "answer_select",
      "ts": "2025-09-20T12:34:56.789Z",
      "round_id": "2c5e...",
      "question_idx": 3,
      "attrs": { "choice": "B" }
    }
  ]
}
```

### フィールド定義
- `client.client_id` (string, 必須): 匿名・端末内で安定。再インストールで変わる想定でも可。
- `client.app_version` (string, 任意): `SemVer` 推奨。
- `client.tz` (string, 任意): `+09:00` 形式。
- `events[].id` (string, 必須): UUIDv4。冪等判定キー。
- `events[].name` (string, 必須): **許可語彙（MVP）**  
  `answer_select`, `answer_result`, `quiz_complete`, `reveal_open_external`, `embed_error`, `embed_fallback_to_link`, `settings_inline_toggle`, `artwork_open`
- `events[].ts` (ISO8601, 必須): UTC。サーバは ±24h まで許容。
- `events[].round_id` (string, 任意): ラウンド識別。可能な限り付与。
- `events[].question_idx` (number, 任意)
- `events[].attrs` (object, 任意): 追加属性（PIIを含めないこと）。

#### FE 実装で送信している属性（2025-09 時点）
| name | attrs |
| --- | --- |
| `answer_select` | `questionId`, `choiceId`, `choiceLabel` |
| `answer_result` | `questionId`, `outcome`, `points`, `remainingSeconds`, `choiceId`, `correctChoiceId`, `elapsedMs` |
| `quiz_complete` | `total`, `points`, `correct`, `wrong`, `timeout`, `skip`, `durationMs` |
| `reveal_open_external` | `questionId`, `provider` |
| `embed_error` | `questionId`, `provider`, `reason` |
| `embed_fallback_to_link` | `questionId`, `provider`, `reason` |
| `settings_inline_toggle` | `enabled` |

> クライアントは `round_id` にラウンドトークン、`question_idx` に 1 始まりの設問番号を設定する。

### バリデーション規則（最小）
- `events` は **1..100**。総ボディ <= 256 KB。
- `name` は許可語彙のみ。未知の名前は `validation_error`。
- `ts` は ISO8601（Z）。過去/未来 **±24h** を越える場合は `validation_error`。
- `attrs` は **1イベントあたり 2 KB** 以内を推奨（超過は切り詰め可）。

## レスポンス
- 成功: `202 Accepted`（**本文なし**）
- クライアントは **レスポンスボディを前提にしない**こと（fire-and-forget）。
- 障害時の情報付加・部分失敗のトラッキングは**将来拡張**とし、本MVPでは返しません。

## エラー（HTTP）
- `429 rate_limited` — `Retry-After` 秒を必ず付与。対象は少なくとも **IP** と `client_id`。
- `413 Payload Too Large` — 256 KB 超過。
- `400 validation_error` — 形式/値が不正。  
  *その他の語彙は* **[API Error Model — 最小仕様](./error-model.md)** *を参照。*

## サーバ実装ノート（最小）
- **重複排除:** `client_id + event.id` をキーに 24h ウィンドウで discard（`ok: true, deduped: true` で応答可）。
- **耐障害性:** ストレージ障害時は item 単位で `failed` とし、他 item を継続。大量失敗時は `internal_error`。
- **レート制限:** めやす: `IP` と `client_id` の両輪で **60 req/min**。実際の数値は運用で変更可能。
- **セキュリティ:** PII を送らない。Origin は allowlist。`gzip` 受理。

## クライアント実装ノート（最小）
- バッチサイズは **<= 20** を推奨（モバイル回線での再送コスト最適化）。
- ネットワーク失敗時は**指数バックオフ**+ジッタ。`429` は `Retry-After` に従う。
- `Idempotency-Key` を**再送時に固定**し、ボディも変えない。

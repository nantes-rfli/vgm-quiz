# API エラーモデル — 最小仕様
- Status: Approved
- Last Updated: 2025-09-19

本書は VGM Quiz API 全体で用いる**機械可読なエラー語彙**と HTTP との対応、再試行可否の原則を定義します。

## レスポンス形
```json
{
  "error": {
    "code": "insufficient_inventory",
    "message": "No questions match the given filters.",
    "retryable": true,
    "details": { "hint": "Try facets=mixed" }
  }
}
```

- `code`: クライアントが分岐に用いる**安定ID**（英小文字+アンダースコア）。
- `message`: デバッグ向け短文（英語推奨）。UI表示はクライアントでローカライズ。
- `retryable`: **再試行で回復見込み**があるなら `true`。
- `details`: 任意の補足。UI ガイダンス等。

## 標準コード対応
| code                    | HTTP | retryable | 用途 |
|------------------------|-----:|:---------:|------|
| validation_error       | 400  | ✖︎ | リクエスト形式/値が不正 |
| invalid_token          | 401  | ✖︎ | 署名不正/改ざん/受理不能 |
| token_expired          | 401  | ○ | `exp` 失効（`/start` で再開可） |
| forbidden              | 403  | ✖︎ | ポリシー/権限で拒否 |
| insufficient_inventory | 409  | ○ | フィルタ在庫不足（条件緩和で回復） |
| rate_limited           | 429  | ○ | レート上限超過（**Retry-After** 秒を必ず付与） |
| internal_error         | 500  | ○ | サーバ内部（短時間で回復見込み） |

### バッチ系APIの部分失敗
- 例: `POST /v1/metrics`。全体は `202 Accepted` とし、`results[]` の各要素に `ok: true/false` と `error` を持たせる。

### クライアント実装の指針（要点）
- `rate_limited` では `Retry-After` ヘッダに従いバックオフ。
- `invalid_token` は**復旧不能**としてラウンドを捨てる。`token_expired` は `/start` から再開可能。
- 409 `insufficient_inventory` は UI で**条件緩和**の提案（例: `facets=mixed` 追加）。


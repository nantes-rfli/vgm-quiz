# Rounds Token (JWS) — 最小仕様
- Status: Approved
- Last Updated: 2025-09-19

本書は Tokenized Round（stateless）方式における **ラウンド進行トークン** の最小仕様を定義します。`/v1/rounds/start` と `/v1/rounds/next` の双方に適用されます。

## 目的と位置づけ
- サーバが**セッションを保持せず**に、ラウンドの整合性（進行順序・フィルタの固定・サンプリングの一貫性）を保証する。
- クライアントはトークンを**保管して往復**するのみ（クライアント検証は不要）。

## 形式
- **JWS Compact Serialization**
- **alg:** `EdDSA`（Ed25519）
- **Header 例**
  - `alg: "EdDSA"`
  - `typ: "JWT"`
  - `kid: "<key-id>"`（任意。鍵ローテーション識別に利用）

## Claims（ペイロード）
| Claim | 型 | 必須 | 説明 |
|---|---|:--:|---|
| `rid` | string | ✓ | Round ID（例: UUIDv4） |
| `idx` | number | ✓ | 現在の問題インデックス（0-based） |
| `max` | number | ✓ | 総問題数（例: 10） |
| `seed` | string | ✓ | サンプリング用シード（16 bytes の base64url 推奨） |
| `filtersHash` | string | ✓ | **正準化**した filters JSON の SHA-256 を base64url 化 |
| `ver` | number | ✓ | トークン仕様バージョン。初期値 `1` |
| `iat` | number | ✓ | 発行時刻（epoch seconds） |
| `exp` | number | ✓ | 失効時刻（epoch seconds）。**TTL = 120 秒** |
| `aud` | string | - | 例: `"rounds"`（任意） |
| `nbf` | number | - | Not Before（任意） |

### filters の正準化（ハッシュ対象）
- キーを **昇順** に並べる、空白無し、真偽・数値は厳密表現（JCS 相当）。
- `filtersHash = base64url( SHA-256( canonicalJSONString ) )`。

## サーバの検証・発行規範
- **署名検証**・`exp` 未失効であること。
- 同一ラウンド内で `rid`/`seed`/`filtersHash`/`max` が**不変**であること。
- `/v1/rounds/next` では受理トークンの `idx` に対し **+1** した `idx` を含む新トークンを発行する（スキップ含め**後戻り不可**）。
- `idx == max-1` の次は `done: true` を返し、ラウンドを終了する（以降の `next` は `invalid_token`）。
- レート制限は **IP + rid** を推奨。

## エラーハンドリング（関連）
- 失効: `token_expired`（HTTP 401）
- 改ざん/不整合: `invalid_token`（HTTP 401）
- レート超過: `rate_limited`（HTTP 429, Retry-After 付与）

## セキュリティ運用ノート
- 署名鍵は Ed25519 を使用し、`kid` でローテーション可能にする。
- トークンは **ベアラー扱い**（漏えい時はラウンド再作成を促す）。
- TTL は短く保つ（MVP: 120 秒）。必要に応じて `/start` の再発行で回復する。


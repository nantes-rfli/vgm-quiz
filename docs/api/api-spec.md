# API Specification (VGM Quiz v1)
- Status: Approved
- Last Updated: 2025-09-19

## 1. Overview

本APIは、クイズ用コンテンツ取得と計測送信のための最小セットを提供する。
エンドポイントは以下の3つ。

- `GET /v1/manifest`（クライアント機能フラグ等のメタ）
- `GET /v1/quizzes/{quizId}/next`（次の設問取得：固定4択）
- `POST /v1/metrics`（計測イベントのバッチ送信）

### 共通

- Base URL: `/<origin>/`（MVPは Cloudflare Pages Functions を想定）
- Auth: なし（PII不収集・短期セッションID前提）
- Request/Response: `application/json; charset=utf-8`
- エラー形式は「7. Error Format」を参照

## 2. Versioning

- バージョンはURLに付与（`/v1/...`）。後方互換を破る変更はメジャーを更新。
- `manifest.schema_version` でサーバ側のスキーマ期待値を通知。

## 3. Manifest

クライアントの挙動を制御するための機能フラグやメタ情報。

### Endpoint

```
GET /v1/manifest
```

### Response

```json
{
  "schema_version": 1,
  "app": {
    "name": "VGM Quiz",
    "revision": "2025-09-19"
  },
  "features": {
    "inlinePlaybackDefault": false,
    "allowEmbedProviders": ["youtube", "appleMusic"],
    "imageProxyEnabled": true
  }
}
```

- `inlinePlaybackDefault`: 結果表示でのインライン埋め込みの既定値
- `allowEmbedProviders`: インライン埋め込みを許可するプロバイダの許可リスト
- `imageProxyEnabled`: 外部アートワーク取得をエッジ・プロキシ経由にするか

## 4. Next Question

次の設問を1件返す。固定4択・内容は正準データに準拠。

### Endpoint

```
GET /v1/quizzes/{quizId}/next
```

### Query/Headers

- 必須ヘッダなし
- サーバ側でセッション継続を持たない想定。クライアントはローカルに出題順を保持

### Response

```json
{
  "quizId": "vgm_v1",
  "sequence": { "index": 1, "total": 10 },
  "question": {
    "id": "q_0001",
    "prompt": "このBGMの作曲者は？",
    "choices": [
      { "id": "a", "label": "作曲者A", "isCorrect": false },
      { "id": "b", "label": "作曲者B", "isCorrect": true },
      { "id": "c", "label": "作曲者C", "isCorrect": false },
      { "id": "d", "label": "作曲者D", "isCorrect": false }
    ],
    "reveal": {
      "links": [
        { "provider": "youtube", "url": "https://www.youtube.com/watch?v=XXXX", "label": "Official OST" },
        { "provider": "appleMusic", "url": "https://music.apple.com/..." }
      ],
      "embedPreferredProvider": "youtube"
    },
    "artwork": {
      "url": "https://upload.wikimedia.org/.../cover.jpg",
      "width": 640,
      "height": 640,
      "alt": "Game cover art",
      "license": "CC BY-SA 4.0",
      "attribution": "© Publisher / Contributor",
      "sourceName": "Wikimedia",
      "sourceUrl": "https://commons.wikimedia.org/...",
      "useProxy": true
    },
    "backup": false,
    "meta": { "lengthSec": 7, "startSec": 30 }
  }
}
```

- `sequence.index` は1始まり
- `reveal` と `artwork` は結果表示に使用（存在しない場合もある）

## 5. Metrics

クライアント計測のバッチ送信。1リクエストに複数イベントを含められる。

### Endpoint

```
POST /v1/metrics
Content-Type: application/json
```

### Request

```json
{
  "session_id": "sess_20250919_abc123",
  "sent_at": "2025-09-19T10:00:00.000Z",
  "events": [
    {
      "type": "answer_select",
      "ts": 1695098400000,
      "questionId": "q_0001",
      "choiceId": "b"
    },
    {
      "type": "answer_result",
      "ts": 1695098401500,
      "questionId": "q_0001",
      "outcome": "correct",
      "remainingSec": 6,
      "scoreDelta": 130
    },
    {
      "type": "reveal_open_external",
      "ts": 1695098403000,
      "questionId": "q_0001",
      "provider": "youtube",
      "url": "https://www.youtube.com/watch?v=XXXX"
    },
    {
      "type": "embed_impression",
      "ts": 1695098404500,
      "questionId": "q_0001",
      "provider": "youtube"
    },
    {
      "type": "embed_play",
      "ts": 1695098406000,
      "questionId": "q_0001",
      "provider": "youtube"
    },
    {
      "type": "embed_error",
      "ts": 1695098407000,
      "questionId": "q_0001",
      "provider": "youtube",
      "error_code": "blocked",
      "reason": "region_restriction"
    },
    {
      "type": "embed_fallback_to_link",
      "ts": 1695098407100,
      "questionId": "q_0001",
      "fromProvider": "youtube"
    },
    {
      "type": "settings_inline_toggle",
      "ts": 1695098450000,
      "enabled": true
    }
  ]
}
```

### Event Types（許容値）

- `answer_select`

  - fields: `questionId`, `choiceId`
- `answer_result`

  - fields: `questionId`, `outcome`（`correct|wrong|timeout|user_skip|system_skip`）, `remainingSec`, `scoreDelta`
- `quiz_complete`

  - fields: `correctCount`, `total`, `score`
- `reveal_open_external`

  - fields: `questionId`, `provider?`, `url?`
- `embed_impression`

  - fields: `questionId`, `provider`
- `embed_play`

  - fields: `questionId`, `provider`
- `embed_error`

  - fields: `questionId`, `provider`, `error_code?`, `reason?`
- `embed_fallback_to_link`

  - fields: `questionId`, `fromProvider`
- `artwork_impression`（任意）

  - fields: `questionId`, `url?`
- `artwork_error`（任意）

  - fields: `questionId`, `url?`, `reason?`
- `settings_inline_toggle`

  - fields: `enabled`

### Response

```json
{ "ok": true }
```

## 6. Constraints（Privacy/Security）

- PIIは送信しない（`session_id` は短期かつ匿名）
- 送信失敗時はクライアントで**再送**（同一イベントIDを実装する場合は冪等処理可）
- レート制限は 1 IP あたり適用（429時は指数バックオフ）

## 7. Error Format

共通のエラー応答。HTTPステータスに整合。

```json
{
  "error": {
    "code": "bad_request",
    "message": "invalid payload",
    "details": { "pointer": "/events/2/provider" }
  }
}
```

- `code` 例: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `rate_limited`, `server_error`
- `details` は任意（フィールドエラーなど）

## 8. Examples

### 8.1 Manifest（200）

```http
GET /v1/manifest
200 OK
```

（本文は「3. Manifest」の例を参照）

### 8.2 Next Question（200）

```http
GET /v1/quizzes/vgm_v1/next
200 OK
```

### 8.3 Metrics（202/200）

```http
POST /v1/metrics
202 Accepted
```

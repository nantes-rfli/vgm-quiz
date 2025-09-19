# API Specification — Tokenized Round (Stateless)
- Status: Approved
- Last Updated: 2025-09-19

> See also: [Rounds Token (JWS) — 最小仕様](./rounds-token-spec.md) · [API エラーモデル — 最小仕様](./error-model.md)

## 1. Overview
本APIはクイズの提供を「フィルタ指定 → 10問サンプリング → トークンで進行」の流れで行う。サーバはセッションを保持しない。署名付きトークンに順序付きID配列と現在位置を内包し、往復で進行する。

- `POST /v1/rounds/start` — 指定条件で問題をサンプリングし、トークンと1問目を返す
- `POST /v1/rounds/next` — トークンを受け取り、次の1問と更新トークンを返す
- `GET /v1/manifest` — モード、ファセット（フィルタ選択肢）、機能フラグ
- `POST /v1/metrics` — 計測バッチ送信
- 付録: `POST /v1/availability`（任意）— フィルタで取得可能な件数を確認

共通: `application/json; charset=utf-8`、PIIなし、エラー形式は「7. Error Format」。

## 2. Concepts
- Mode: クイズの編成単位（例: `vgm_v1-ja`）。ロケールやテーマ別に分ける。
- Facets: フィルタに使える軸（例: `era`, `difficulty`, `series`）。
- Token: 署名付きJWS。順序付きID配列と現在位置などを含むクライアント所有の進行状態。

## 3. Endpoints

### 3.1 Start Round
```
POST /v1/rounds/start
```
**Body**
```json
{
  "mode": "vgm_v1-ja",
  "filters": { "era": ["90s"], "difficulty": ["mixed"] },
  "total": 10,
  "seed": "optional-string"
}
```

**Response**
```json
{
  "round": {
    "mode": "vgm_v1-ja",
    "sequence": { "index": 1, "total": 10 },
    "token": "<JWS-compact-string>"
  },
  "question": { }
}
```

- サーバは `filters` に合致する問題IDを重複なしで `total` 件サンプリングし、順序付き配列をトークンに封入する。
- `seed` は決定論を高めたい場合に利用可能。同一データ集合と同一 `seed` で同じ並びとなる。

### 3.2 Next Question
```
POST /v1/rounds/next
```
**Body**
```json
{ "token": "<JWS-compact-string>" }
```

**Response**
```json
{
  "round": {
    "sequence": { "index": 2, "total": 10 },
    "token": "<updated-JWS>"
  },
  "question": { },
  "hasMore": true
}
```

- トークン内の現在位置を1つ進め、該当IDの問題を返す。
- 最終問後は `hasMore: false`。必要なら `question` を省略可能。

### 3.3 Manifest
```
GET /v1/manifest
```
**Response**
```json
{
  "schema_version": 2,
  "app": { "name": "VGM Quiz", "revision": "2025-09-19" },
  "features": {
    "inlinePlaybackDefault": false,
    "allowEmbedProviders": ["youtube", "appleMusic"],
    "imageProxyEnabled": true
  },
  "modes": [
    { "id": "vgm_v1-ja", "title": "VGM Quiz Vol.1 (JA)", "defaultTotal": 10, "locale": "ja" }
  ],
  "facets": {
    "era": ["80s","90s","00s","10s","mixed"],
    "difficulty": ["easy","normal","hard","mixed"],
    "series": ["ff","dq","zelda","mario","mixed"]
  }
}
```

### 3.4 Metrics
```
POST /v1/metrics
```
**Request（例）**
```json
{
  "session_id": "sess_abc",
  "sent_at": "2025-09-19T10:00:00.000Z",
  "round_token": "<JWS-truncated>",
  "events": [
    { "type": "answer_select", "ts": 1695098400000, "questionId": "q_0001", "choiceId": "b" },
    { "type": "answer_result", "ts": 1695098401500, "questionId": "q_0001", "outcome": "correct", "remainingSec": 6, "scoreDelta": 130 },
    { "type": "reveal_open_external", "ts": 1695098403000, "questionId": "q_0001", "provider": "youtube" },
    { "type": "embed_error", "ts": 1695098407000, "questionId": "q_0001", "provider": "youtube", "reason": "region_restriction" },
    { "type": "settings_inline_toggle", "ts": 1695098450000, "enabled": true }
  ]
}
```

- 許容イベントは `reveal_open_external`, `embed_impression`, `embed_play`, `embed_error`, `embed_fallback_to_link`, `artwork_impression`, `artwork_error`, `settings_inline_toggle`, `answer_select`, `answer_result`, `quiz_complete` を想定する。

### 3.5 Availability（任意）
```
POST /v1/availability
```
**Body**
```json
{ "mode": "vgm_v1-ja", "filters": { "era": ["90s"], "difficulty": ["mixed"] } }
```
**Response**
```json
{ "available": 14 }
```

## 4. Schemas

### 4.1 Question
```json
{
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
  "meta": { "lengthSec": 7, "startSec": 30, "kind": "title_to_composer" }
}
```

### 4.2 Token（JWS payload の論理構造）
```json
{
  "mode": "vgm_v1-ja",
  "filters": { "era": ["90s"], "difficulty": ["mixed"] },
  "ids": ["q_0001","q_0007","q_0012"],
  "i": 0,
  "limit": 10,
  "seed": "optional",
  "policyVersion": 1,
  "exp": 1760000000
}
```
- 署名方式は JWS（HMAC-SHA256）を想定。改ざん不可。
- `exp` により短TTLで運用する。IDは難読化を推奨。

## 5. Flows

### 5.1 初回
- `GET /v1/manifest` で `modes` と `facets` を取得
- `POST /v1/rounds/start`（mode、filters、total、seed）でトークンと1問目を受け取る
- 出題 → 回答 → 結果表示
- 次へで `POST /v1/rounds/next`（token）を呼ぶ
- 10問後 `hasMore: false` で `/result` へ

### 5.2 途中再開
- 保存しておいた `token` で `POST /v1/rounds/next` を再開
- `exp` 超過は `401 unauthorized_token` でやり直し

## 6. Security & Limits
- レート制限と署名検証エラーで乱用を抑止
- `token` は短TTL（例: 1時間）
- `POST /v1/metrics` は冪等IDの導入を推奨（重複除去）
- CORS は `GET` と `POST` のみ許可

## 7. Error Format
```json
{
  "error": {
    "code": "bad_request",
    "message": "invalid filters",
    "details": { "pointer": "/filters/era/0" }
  }
}
```
- `code`: `bad_request`, `unauthorized_token`, `not_found`, `rate_limited`, `server_error`, `insufficient_inventory` など
- `insufficient_inventory`: 指定 `filters` で `total` を満たせない場合

## 8. Changelog
- 2025-09-19: Tokenized Round（stateless）を導入。`rounds/start` と `rounds/next` を追加。既存の `GET /v1/quizzes/{quizId}/next` は段階的に廃止予定。

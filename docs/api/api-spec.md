# API Specification — Tokenized Round (Stateless)
- Status: Approved
- Last Updated: 2025-11-03

> See also:
> - [Rounds Token (JWS) — 最小仕様](./rounds-token-spec.md)
> - [API Error Model — 最小仕様](./error-model.md)
> - [Embed Vocabulary — 最小仕様](../data/embed-vocabulary.md)
> - [Embed Policy and Fallback — 最小仕様](../product/embed-policy.md)
> - [Metrics Ingest API — 最小仕様](./metrics-endpoint.md)

## 1. Overview
本APIはクイズの提供を「フィルタ指定 → 10問サンプリング → トークンで進行」の流れで行う。サーバはセッションを保持しない。署名付きトークンに順序付きID配列と現在位置を内包し、往復で進行する。

- `POST /v1/rounds/start` — 指定条件で問題をサンプリングし、トークンと1問目を返す
- `POST /v1/rounds/next` — トークン＋直前の回答（`answer`）を受け取り、**直前の結果（`reveal`）**と次の1問を返す
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
    "id": "round_2025-11-03_t8s",
    "mode": "vgm_v1-ja",
    "date": "2025-11-03",
    "filters": { "difficulty": "mixed", "era": "90s" },
    "progress": { "index": 1, "total": 10 },
    "token": "<JWS-compact-string>"
  },
  "question": {
    "id": "q_0001",
    "title": "この曲のゲームタイトルは?"
  },
  "choices": [
    { "id": "a", "text": "Chrono Trigger" },
    { "id": "b", "text": "Final Fantasy VI" },
    { "id": "c", "text": "Secret of Mana" },
    { "id": "d", "text": "Phantasy Star IV" }
  ],
  "continuationToken": "<JWS-compact-string>",
  "progress": { "index": 1, "total": 10 }
}
```

- サーバは `filters` に合致する問題セットを日次バッチ（Publishステージ）から復元し、既存セットがない場合は `503 no_questions` を返す。
- `total` は Publish 済みセットと一致する必要がある（不一致は `422 insufficient_inventory`）。
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
  "result": {
    "correct": true,
    "correctAnswer": "b",
    "reveal": {
      "title": "Terra's Theme",
      "game": "Final Fantasy VI"
    }
  },
  "question": {
    "id": "q_0002",
    "title": "この曲のゲームタイトルは?"
  },
  "choices": [
    { "id": "a", "text": "Chrono Trigger" },
    { "id": "b", "text": "Final Fantasy VI" },
    { "id": "c", "text": "Rudra no Hihou" },
    { "id": "d", "text": "Romancing SaGa 3" }
  ],
  "continuationToken": "<updated-JWS>",
  "progress": { "index": 2, "total": 10 },
  "finished": false
}
```

- トークン内の現在位置を1つ進め、該当IDの問題を返す。
- 最終問後は `finished: true` となり、`question` と `choices` は省略される。
- トークンは都度更新され、`idx` がインクリメントされる。

### 3.3 Manifest
```
GET /v1/manifest
```
**Response**
```json
{
  "schema_version": 2,
  "features": {
    "inlinePlaybackDefault": false,
    "imageProxyEnabled": false
  },
  "modes": [
    { "id": "vgm_v1-ja", "title": "VGM Quiz Vol.1 (JA)", "defaultTotal": 10, "locale": "ja" }
  ],
  "facets": {
    "era": ["80s", "90s", "00s", "10s", "20s", "mixed"],
    "difficulty": ["easy", "normal", "hard", "mixed"],
    "series": ["ff", "dq", "zelda", "mario", "sonic", "pokemon", "mixed"]
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
    { "id": "a", "label": "作曲者A" },
    { "id": "b", "label": "作曲者B" },
    { "id": "c", "label": "作曲者C" },
    { "id": "d", "label": "作曲者D" }
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


> Security Note: `choices[].isCorrect` はクライアントへは配布しません。正誤判定はサーバ側で行い、回答送信後に**直前1問分のみ** `reveal` として返します（将来の問題の正解は露出しません）。

### 4.2 Token（JWS payload の論理構造）
```json
{
  "rid": "9fdc4d7c-0a1b-4d6c-9a3d-63d6e3c8dbf2",
  "idx": 0,
  "total": 10,
  "seed": "Z3ikN0H1P4Qc2As1",
  "filtersHash": "3fa4b1c2",
  "filtersKey": "{\"difficulty\":\"mixed\",\"era\":\"90s\"}",
  "mode": "vgm_v1-ja",
  "date": "2025-11-03",
  "ver": 1,
  "iat": 1760000000,
  "exp": 1760000120,
  "aud": "rounds"
}
```
- 署名方式は JWS（HMAC-SHA256）。`filtersHash` は `filtersKey` のハッシュ（`hashFilterKey`）。
- `filtersKey` は正規化済みフィルタJSON文字列（空条件は `'{}'`）。
- `date` はJST基準の日付。`idx` は0ベース。
- `exp` により短TTLで運用する。

## 5. Flows

### 5.1 初回
- `GET /v1/manifest` で `modes` と `facets` を取得
- `POST /v1/rounds/start`（mode、filters、total、seed）でトークンと1問目を受け取る
- 出題 → 回答 → 結果表示
- 次へで `POST /v1/rounds/next`（token）を呼ぶ
  - 10問後 `finished: true` で `/result` へ

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

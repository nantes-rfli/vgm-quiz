# Data Model (VGM Quiz)
- Status: Active (Phase 2+)
- Last Updated: 2025-11-11

## この文書の目的

クライアント側とサーバー側の**正準データ構造**を定義する。
出題・回答・採点・結果表示（紹介リンク/埋め込み・アートワーク）、およびフィルタ選択に必要な最小フィールドを規定する。

## 1. エンティティ

### Question

- `id: string`
- `prompt: string`
- `choices: { id: string, label: string }[]`
  - **固定4件**。提示順のみクライアントでシャッフル可（内容は固定）
- `reveal?:` **// 結果表示での紹介用メタ** 
```
{
    links: { provider?: "youtube" | "appleMusic" | "spotify" | "other", url: string, label?: string }[];
    embedPreferredProvider?: "youtube" | "appleMusic" | null;
}
```
- `artwork?:` **// 結果表示でのカバー画像（外部参照推奨）**
```
 { 
    url: string;
    width?: number; height?: number; // CLS回避用に推奨
    alt?: string;
    license?: string; attribution?: string;
    sourceName?: string; sourceUrl?: string;
    useProxy?: boolean; // 画像プロキシ経由で配信する場合
}
```
- `backup: boolean`（バックアップ問題か）
- `meta?: { lengthSec?: number, startSec?: number }`（表示・説明用の最小メタ）

### Session (local)

- `sessionId: string`（短期・ローカルのみ）
- `createdAt: string`（ISO8601）
- `questionOrder: string[]`（出題順のID）
- `answers:` **// 1問につき1レコード**
```
{ 
    questionId: string;
    choiceId?: string; // 未回答/スキップ時は欠落
    outcome: "correct" | "wrong" | "timeout" | "user_skip" | "system_skip";
    remainingSec: number; // 0〜15（timeoutは0）
}[]
```
- `score: number`（**正解：100 + 残秒×5** の合計）
- `completed: boolean`

### Manifest (API レスポンス)

**フィルタ UI と API 統合の中核となるメタデータ**

- `schema_version: number`
  - スキーマのバージョン。変更があればクライアント側でキャッシュを無効化
- `modes: { id: string, title: string, defaultTotal: number, locale: string }[]`
  - サポートするクイズモード（例: `vgm_v1-ja`）
- `facets: { [facetName: string]: string[] }`
  - フィルタに使用可能なファセット値
  - 例: `{ difficulty: ["easy", "normal", "hard", "mixed"], era: ["80s", "90s", ...], series: ["ff", "dq", ...] }`
- `features: { [featureName: string]: boolean }`
  - フロント機能のフラグ（例: `inlinePlaybackDefault`, `imageProxyEnabled`）

### FilterOptions (ユーザー選択フィルタ)

**フロントエンドで管理、API 送信時に使用**

```typescript
interface FilterOptions {
  difficulty?: "easy" | "normal" | "hard" | "mixed"
  era?: "80s" | "90s" | "00s" | "10s" | "20s" | "mixed"
  series?: string[] // ["ff", "dq", "zelda", ...]
}
```

**特徴**:
- Difficulty & Era は単一値のみ（`mixed` で全選択）
- Series は複数値をサポート
- `mixed` はフィルタリングでスキップされ、実質的に「全選択」を意味する
- API 送信時は配列形式に統一（バックエンド処理の簡素化）

### Round (API レスポンス内の round フィールド)

**ラウンド開始後のクイズセッション情報**

- `id: string` — ラウンド ID
- `mode: string` — モード ID（例: `vgm_v1-ja`）
- `date: string` — 実施日付（YYYY-MM-DD）
- `filters: FilterOptions` — リクエスト時に指定されたフィルタ（**正規化済み**）
  - Difficulty & Era は文字列として返却
  - Series はソート済みの配列
- `progress: { index: number, total: number }` — 現在位置
- `token: string` — トークン（JWS）

---

## 2. スキーマ例（JSON）

### Question（例）

```json
{
  "id": "q_0001",
  "prompt": "このBGMの作曲者は？",
  "choices": [
    { "id": "a", "label": "作曲者 A"},
    { "id": "b", "label": "作曲者 B"},
    { "id": "c", "label": "作曲者 C"},
    { "id": "d", "label": "作曲者 D"}
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
```

### Session (local)（例）

```json
{
  "sessionId": "sess_20250919_abc123",
  "createdAt": "2025-09-19T10:00:00.000Z",
  "questionOrder": ["q_0001", "q_0002", "q_0003", "..."],
  "answers": [
    {
      "questionId": "q_0001",
      "choiceId": "b",
      "outcome": "correct",
      "remainingSec": 6
    },
    {
      "questionId": "q_0002",
      "outcome": "user_skip",
      "remainingSec": 12
    }
  ],
  "score": 130,
  "completed": true
}
```

### Manifest（例）

```json
{
  "schema_version": 2,
  "modes": [
    {
      "id": "vgm_v1-ja",
      "title": "VGM Quiz Vol.1 (JA)",
      "defaultTotal": 10,
      "locale": "ja"
    }
  ],
  "facets": {
    "difficulty": ["easy", "normal", "hard", "mixed"],
    "era": ["80s", "90s", "00s", "10s", "20s", "mixed"],
    "series": ["ff", "dq", "zelda", "mario", "sonic", "pokemon", "mixed"]
  },
  "features": {
    "inlinePlaybackDefault": false,
    "imageProxyEnabled": false
  }
}
```

### Round（例）

```json
{
  "round": {
    "id": "round_2025-11-11_abc123",
    "mode": "vgm_v1-ja",
    "date": "2025-11-11",
    "filters": {
      "difficulty": "hard",
      "era": "90s",
      "series": ["dq", "ff"]
    },
    "progress": {
      "index": 1,
      "total": 10
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyaWQiOiI5ZmRjNGQ3Yy0wYTFiLTRkNmMtOWEzZC02M2Q2ZTNjOGRiZjIiLCJpZHgiOjAsInRvdGFsIjoxMCwiZmlsdGVyc0hhc2giOiJhMWIyYzNkNCIsImZpbHRlcnNLZXkiOiJ7XCJkaWZmaWN1bHR5XCI6XCJoYXJkXCIsXCJlcmFcIjpcIjkwc1wiLFwic2VyaWVzXCI6W1wiZHFcIixcImZmXCJdfSIsIm1vZGUiOiJ2Z21fdjEtamEiLCJkYXRlIjoiMjAyNS0xMS0xMSIsInZlciI6MSwiaWF0IjoxNzMxMjg0NDAwLCJleHAiOjE3MzEyODgwMDAsImF1ZCI6InJvdW5kcyJ9.signature"
  },
  "question": {
    "id": "q_0001",
    "title": "この曲のゲームタイトルは？"
  },
  "choices": [
    { "id": "a", "text": "Final Fantasy VII" },
    { "id": "b", "text": "Dragon Quest VIII" },
    { "id": "c", "text": "Zelda: Ocarina of Time" },
    { "id": "d", "text": "Super Mario 64" }
  ],
  "continuationToken": "...",
  "progress": {
    "index": 1,
    "total": 10
  }
}
```

---

## 3. バリデーション方針

- **Question**

  - `choices` は常に4件・正解はサーバ側にのみ存在（クライアントへは配布しない）
  - `reveal.links` は **0件以上**（用意があればURLはHTTPS推奨）
  - `reveal.embedPreferredProvider` は `reveal.links[*].provider` のいずれか、もしくは `null`
  - `artwork.url` はHTTPS推奨、`width`/`height` は指定推奨、`alt` は必須
  - `backup: true` は通常ローテから除外

- **Manifest**
  - `schema_version` は整数、変更があればクライアントキャッシュを無効化
  - `modes` は1件以上、各モードは `id`, `title`, `defaultTotal`, `locale` を必須
  - `facets` の各値は **1件以上の有効値を含む** + `"mixed"` オプション
  - `features` の値はブール値

- **FilterOptions**
  - `difficulty` & `era` は単一値のみ（複数指定時は API 400 エラー）
  - `series` は複数値をサポート
  - `"mixed"` はフィルタリングされ、実質的に「全選択」を意味する
  - API 送信時は配列形式に統一

- **Session (local)**

  - `answers.length === questionOrder.length`（`system_skip` も1問として記録）
  - `outcome` はいずれか1つ／`timeout` の `remainingSec` は **0**
  - `score` は「正解：100 + 残秒×5」「その他：0」の合計と一致

- **Round**
  - `filters` は API リクエスト値から正規化されたもの
  - Difficulty & Era は文字列として返却
  - Series はソート済みの配列（重複なし）

---

## 4. 表示順シャッフルの扱い（参考）

- クライアントは **提示順のみ**シャッフル可（内容は固定）。
- 再現性が必要なら `sessionId + questionId` をシードに決定論的に行う。

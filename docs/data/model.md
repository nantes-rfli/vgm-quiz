# Data Model (VGM Quiz MVP)
- Status: Approved
- Last Updated: 2025-09-19

## この文書の目的

MVPにおける**クライアント側の正準データ構造**を定義する。
出題・回答・採点・結果表示（紹介リンク/埋め込み・アートワーク）のために必要な最小フィールドを規定する。

## 1. エンティティ

### Question

- `id: string`
- `prompt: string`
- `choices: { id: string, label: string, isCorrect: boolean }[]`
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

---

## 2. スキーマ例（JSON）

### Question（例）

```json
{
  "id": "q_0001",
  "prompt": "このBGMの作曲者は？",
  "choices": [
    { "id": "a", "label": "作曲者 A", "isCorrect": false },
    { "id": "b", "label": "作曲者 B", "isCorrect": true },
    { "id": "c", "label": "作曲者 C", "isCorrect": false },
    { "id": "d", "label": "作曲者 D", "isCorrect": false }
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

---

## 3. バリデーション方針

- **Question**

  - `choices` は常に4件・`isCorrect` は1件のみ
  - `reveal.links` は **0件以上**（用意があればURLはHTTPS推奨）
  - `reveal.embedPreferredProvider` は `reveal.links[*].provider` のいずれか、もしくは `null`
  - `artwork.url` はHTTPS推奨、`width`/`height` は指定推奨、`alt` は必須
  - `backup: true` は通常ローテから除外
- **Session (local)**

  - `answers.length === questionOrder.length`（`system_skip` も1問として記録）
  - `outcome` はいずれか1つ／`timeout` の `remainingSec` は **0**
  - `score` は「正解：100 + 残秒×5」「その他：0」の合計と一致

---

## 4. 表示順シャッフルの扱い（参考）

- クライアントは **提示順のみ**シャッフル可（内容は固定）。
- 再現性が必要なら `sessionId + questionId` をシードに決定論的に行う。

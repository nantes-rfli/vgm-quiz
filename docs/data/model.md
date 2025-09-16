# Data Model (VGM Quiz MVP)
- Status: Approved
- Last Updated: 2025-09-16

## この文書の目的
設問・音源ソース・採点に関する**クライアント側の正準データ構造**を定義する（MVPでは出題生成/採点/セッション保存はクライアント責務）。

## 1. エンティティ
### Question
- `id: string`
- `prompt: string`
- `choices: { id: string, label: string, isCorrect: boolean }[]`（**固定4件**。表示順はクライアントでシャッフル可）
- `sources: { provider: string, url: string, priority: number }[]`（優先度昇順）
- `backup: boolean`（バックアップ問題か）
- `meta?: { lengthSec?: number, startSec?: number }`

### Session (local)
- `sessionId: string`（短期・ローカルのみ）
- `createdAt: string`（ISO8601）
- `questionOrder: string[]`（出題順のID）
- `answers: `（1問につき1レコード）
```ts
  {
    questionId: string;
    choiceId?: string;            // 未回答/スキップ時は欠落
    outcome: 'correct' | 'wrong' | 'timeout' | 'user_skip' | 'system_skip';
    remainingSec: number;         // 0〜15（timeoutは0）
    sourceUsed?: { provider: string; url: string };
  }[]
```
- `score: number`（正解：100 + 残秒×5 の合計）
- `firstSoundMs?: number`（初回TTFS）
- `completed: boolean`

## 2. スキーマ例（JSON）
### Question（例）
```json
{
  "id": "q_0001",
  "prompt": "「Battle Theme X」の作曲者は？",
  "choices": [
    { "id": "composer_ue", "label": "植松 伸夫", "isCorrect": true },
    { "id": "composer_km", "label": "近藤 浩治", "isCorrect": false },
    { "id": "composer_sy", "label": "下村 陽子", "isCorrect": false },
    { "id": "composer_mt", "label": "光田 康典", "isCorrect": false }
  ],
  "sources": [
    { "provider": "ext1", "url": "https://example.com/track1", "priority": 1 },
    { "provider": "ext2", "url": "https://example.com/track1b", "priority": 2 }
  ],
  "backup": false,
  "meta": { "lengthSec": 30, "startSec": 0 }
}
```

### Session (local)（例）
```json
{
  "sessionId": "sess_20250916_abc123",
  "createdAt": "2025-09-16T10:00:00.000Z",
  "questionOrder": ["q_0001","q_0002", "..."],
  "answers": [
    {
      "questionId": "q_0001",
      "choiceId": "composer_ue",
      "outcome": "correct",
      "remainingSec": 7,
      "sourceUsed": { "provider": "ext1", "url": "https://example.com/track1" }
    },
    {
      "questionId": "q_0002",
      "outcome": "system_skip",
      "remainingSec": 15
    }
  ],
  "score": 1234,
  "firstSoundMs": 520,
  "completed": true
}
```

## 3. バリデーション方針
- **Question**
  - `choices` は常に4件・`isCorrect` は1件のみ
  - `sources` は1件以上・`priority` の重複なし（昇順で評価）
  - `backup: true` は通常ローテに含めない

- **Session (local)**
  - `answers.length === questionOrder.length`（System Skipも1問として記録）
  - `outcome` はいずれか1つ／`timeout` の `remainingSec` は **0**
  - `score` は各問の規則（正解：100 + 残秒×5、その他：0）の合計と一致

## 4. 表示順シャッフルの扱い（参考）
- クライアントは **提示順のみ**シャッフル可（内容は固定）。
- 再現性が必要なら `sessionId + questionId` 由来のシードで決定論的に行う。

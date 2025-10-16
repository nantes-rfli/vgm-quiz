# Curated Data Format – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-16
- **Purpose**: Phase 1 手動キュレーションデータの形式定義

## File Location

```
workers/data/curated.json
```

## Schema

### JSON Structure

```typescript
interface CuratedData {
  version: string           // Semantic version (e.g., "1.0.0")
  tracks: Track[]           // Array of curated tracks
}

type Difficulty = 'easy' | 'normal' | 'hard'
type Era = '80s' | '90s' | '00s' | '10s' | '20s'

interface Track {
  id: string                // Unique ID (e.g., "001", "002")
  title: string             // Track title
  game: string              // Game title (正解の選択肢)
  series?: string           // Series name (e.g., "Final Fantasy")
  composer: string          // Composer name
  platform?: string         // Platform (e.g., "SNES", "PlayStation")
  year: number              // Release year
  youtube_url: string       // YouTube video URL
  spotify_url: string       // Spotify track URL
  // Phase 2A: Extended metadata for filtering
  difficulty?: Difficulty   // Recognition difficulty (easy/normal/hard)
  genres?: string[]         // Genre tags (non-empty if provided)
  seriesTags?: string[]     // Series abbreviations (vocabulary controlled)
  era?: Era                 // Decade classification (80s-20s)
}
```

### Validation Rules

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `id` | ✅ | string | Unique, alphanumeric |
| `title` | ✅ | string | Min 1 char |
| `game` | ✅ | string | Min 1 char, **must be unique** |
| `series` | ❌ | string | - |
| `composer` | ✅ | string | Min 1 char |
| `platform` | ❌ | string | - |
| `year` | ✅ | number | 1980-2030 |
| `youtube_url` | ✅ | string | Valid URL |
| `spotify_url` | ✅ | string | Valid URL |
| `difficulty` | ❌ | string | One of: easy, normal, hard |
| `genres` | ❌ | string[] | Non-empty array if provided; values must use the curated genre vocabulary below |
| `seriesTags` | ❌ | string[] | Array of approved abbreviations (see vocabulary below) |
| `era` | ❌ | string | One of: 80s, 90s, 00s, 10s, 20s |

> `id` は Phase 1 の `tracks_normalized.external_id` にマッピングされ、再取り込み時の重複排除に利用します。

#### Phase 2A Extended Fields

**difficulty** - Recognition difficulty level for quiz questions:
- `easy`: Iconic tracks with widespread recognition (e.g., "One-Winged Angel", "Tetris Theme")
- `normal`: Well-known tracks within their genre/series community
- `hard`: Niche tracks or lesser-known titles

**genres** - Game genre classifications (1-3 tags recommended):
- Allowed vocabulary: `action`, `action-adventure`, `action-rpg`, `adventure`, `arcade`, `fighting`, `fps`, `indie`, `jrpg`, `platformer`, `puzzle`, `rpg`, `shooter`, `simulation`, `strategy`

**seriesTags** - Series abbreviations for quick filtering:
- Allowed vocabulary: `chrono`, `civ`, `ff`, `halo`, `kh`, `mario`, `metroid`, `nier`, `persona`, `pokemon`, `portal`, `sf`, `sonic`, `sotc`, `tes`, `tetris`, `undertale`, `xenoblade`, `zelda`

**era** - Decade classification based on release year:
- `80s`: 1980-1989
- `90s`: 1990-1999
- `00s`: 2000-2009
- `10s`: 2010-2019
- `20s`: 2020-2029

### 重要な制約

**最低4つのユニークなゲームタイトルが必要**

Phase 1 では、4択問題を生成するために**最低4つの異なるゲームタイトル**が必要です。

- 同じゲームから複数の楽曲を含める場合でも、選択肢生成のために他に3つ以上の異なるゲームタイトルが必要
- 例: "Final Fantasy VII" の楽曲を2曲含める場合、他に最低3つの異なるゲーム（例: "Chrono Trigger", "Secret of Mana", "Super Mario 64"）が必要
- ユニークなゲームタイトルが4つ未満の場合、Publishステージでエラーが発生します

**推奨**:
- 最低: 4つのユニークなゲームタイトル（問題数は任意）
- 推奨: 10問生成する場合、10個のユニークなゲームタイトル（各ゲーム1曲ずつ）

## Example

### Example Dataset (excerpt)

```json
{
  "version": "1.0.0",
  "tracks": [
    {
      "id": "001",
      "title": "Green Hill Zone",
      "game": "Sonic the Hedgehog",
      "series": "Sonic",
      "composer": "Masato Nakamura",
      "platform": "Genesis",
      "year": 1991,
      "youtube_url": "https://youtube.com/watch?v=SF9ZLNxHaBY",
      "spotify_url": "https://open.spotify.com/track/2MZSXhq4XDJWu6coGoXX18",
      "difficulty": "easy",
      "genres": [
        "platformer",
        "action"
      ],
      "seriesTags": [
        "sonic"
      ],
      "era": "90s"
    },
    {
      "id": "002",
      "title": "Gusty Garden Galaxy",
      "game": "Super Mario Galaxy",
      "series": "Super Mario",
      "composer": "Mahito Yokota",
      "platform": "Wii",
      "year": 2007,
      "youtube_url": "https://youtube.com/watch?v=bcZhJDUFb58",
      "spotify_url": "https://open.spotify.com/track/1rHXQ8VF9pG4jP9VZkFqVd",
      "difficulty": "easy",
      "genres": [
        "platformer",
        "adventure"
      ],
      "seriesTags": [
        "mario"
      ],
      "era": "00s"
    },
    {
      "id": "003",
      "title": "Gerudo Valley",
      "game": "The Legend of Zelda: Ocarina of Time",
      "series": "The Legend of Zelda",
      "composer": "Koji Kondo",
      "platform": "Nintendo 64",
      "year": 1998,
      "youtube_url": "https://youtube.com/watch?v=Hy0aEj85ifY",
      "spotify_url": "https://open.spotify.com/track/5a5KbMCLqIBZ7L5lq9PFkR",
      "difficulty": "easy",
      "genres": [
        "action-adventure",
        "rpg"
      ],
      "seriesTags": [
        "zelda"
      ],
      "era": "90s"
    }
  ]
}
```

## Data Preparation Guidelines

### 1. Track Selection Criteria

**Diversity**:
- ✅ 異なるシリーズから選ぶ (同一シリーズは最大2曲)
- ✅ 異なるプラットフォームから選ぶ (世代バランス)
- ✅ 異なる年代から選ぶ (1980s-2020s)

**Quality**:
- ✅ 有名な楽曲を優先 (認知度が高い)
- ✅ メタデータが充実している楽曲
- ✅ YouTube/Spotify で視聴可能な楽曲

**Avoid**:
- ❌ アンビエント系 (静かすぎる)
- ❌ 効果音メイン
- ❌ 極端に短い (<30秒) or 長い (>5分)

### 2. Choices Generation Logic

Publish ステージで自動生成される選択肢の仕組み:

```typescript
// 正解: Final Fantasy VII
// 誤答候補: 他の楽曲の game からランダム選択

function generateChoices(
  correctTrack: Track,
  allTracks: Track[]
): Choice[] {
  const correct = { id: 'a', text: correctTrack.game, correct: true }

  // 誤答候補を抽出 (重複排除)
  const wrongCandidates = allTracks
    .filter((t) => t.game !== correctTrack.game)
    .map((t) => t.game)
    .filter((game, index, self) => self.indexOf(game) === index)

  if (wrongCandidates.length < 3) {
    throw new Error('選択肢用のタイトルが不足しています (3件以上用意してください)')
  }

  const wrong = shuffleArray(wrongCandidates)
    .slice(0, 3)
    .map((game, index) => ({
      id: ['b', 'c', 'd'][index],
      text: game,
      correct: false,
    }))

  return shuffleArray([correct, ...wrong])
}

function shuffleArray<T>(items: T[]): T[] {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = array[i]
    array[i] = array[j]
    array[j] = tmp
  }
  return array
}
```

**制約**:
- 同じ game は選択肢に含めない
- 選択肢は4つ (1正解 + 3誤答)
- 選択肢はアルファベット順にソートしない (ランダム配置)

### 3. Recommended Track Count

| Purpose | Count | Reason |
|---------|-------|--------|
| **Minimal Test** | 10 | 1日分 (開発テスト用) |
| **Phase 1 Launch** | 100 | 10日分 (初期運用) |
| **Phase 1 Extended** | 300 | 30日分 (1ヶ月運用) |

**Phase 1 推奨**: 100曲 (10日分)
- 初期ユーザーが飽きない程度の量
- Phase 2 で自動化に移行するまでの期間

## Validation Script

### `workers/scripts/validate-curated.ts`

The Phase 2A validator enforces the extended schema and metadata rules. Highlights:

- Required fields (`id`, `title`, `game`, `composer`, `year`, `youtube_url`, `spotify_url`) and SemVer `version` are validated with Zod.
- Enumerated metadata: `difficulty`, `genres`, `seriesTags`, and `era` must use the approved vocabularies.
- Track-level checks include duplicate ID detection and friendly contextual error messages.
- Collection-level checks ensure at least four unique `game` values, with warnings for low variety.
- Output separates errors and warnings, exiting with status code `1` on failure.

### Usage

```bash
cd workers
npm run validate:curated
```

### CI Integration

Pull Request チェックとして `.github/workflows/validate-data.yml` を用意しており、`workers/data/curated.json` または検証スクリプトに変更が入った場合に自動で `npm run validate:curated` を実行します。手動検証に加えて、PR 上での失敗をトリガーにデータ品質を維持できます。

### Sample Output

```text
✅ VALIDATION PASSED

  Version: 1.0.0
  Tracks: 20
  Unique games: 20
```

## Import into D1

Discovery ステージで以下のように読み込み:

```typescript
import curatedData from '../data/curated.json'

async function importCuratedData(db: D1Database): Promise<void> {
  for (const track of curatedData.tracks) {
    await db.prepare(`
      INSERT INTO tracks_normalized (
        external_id,
        title,
        game,
        series,
        composer,
        platform,
        year,
        youtube_url,
        spotify_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(external_id) DO NOTHING
    `).bind(
      track.id,
      track.title,
      track.game,
      track.series || null,
      track.composer || null,
      track.platform || null,
      track.year || null,
      track.youtube_url || null,
      track.spotify_url || null
    ).run()
  }
}
```

## Next Steps

1. 実際に 100曲のデータを手動キュレーション
2. `curated.json` を `workers/data/` に配置
3. Validation スクリプトで検証
4. Discovery ステージで D1 に読み込み

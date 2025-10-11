# Curated Data Format – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10
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

interface Track {
  id: string                // Unique ID (e.g., "001", "002")
  title: string             // Track title
  game: string              // Game title (正解の選択肢)
  series?: string           // Series name (e.g., "Final Fantasy")
  composer?: string         // Composer name
  platform?: string         // Platform (e.g., "SNES", "PlayStation")
  year?: number             // Release year
  youtube_url?: string      // YouTube video URL
  spotify_url?: string      // Spotify track URL
}
```

### Validation Rules

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `id` | ✅ | string | Unique, alphanumeric |
| `title` | ✅ | string | Min 1 char |
| `game` | ✅ | string | Min 1 char |
| `series` | ❌ | string | - |
| `composer` | ❌ | string | - |
| `platform` | ❌ | string | - |
| `year` | ❌ | number | 1980-2030 |
| `youtube_url` | ❌ | string | Valid URL |
| `spotify_url` | ❌ | string | Valid URL |

> `id` は Phase 1 の `tracks_normalized.external_id` にマッピングされ、再取り込み時の重複排除に利用します。

## Example

### Minimal (10 tracks)

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
      "spotify_url": "https://open.spotify.com/track/2MZSXhq4XDJWu6coGoXX18"
    },
    {
      "id": "002",
      "title": "Super Mario Bros. Theme",
      "game": "Super Mario Bros.",
      "series": "Mario",
      "composer": "Koji Kondo",
      "platform": "NES",
      "year": 1985,
      "youtube_url": "https://youtube.com/watch?v=NTa6Xbzfq1U"
    },
    {
      "id": "003",
      "title": "The Legend of Zelda Main Theme",
      "game": "The Legend of Zelda",
      "series": "Zelda",
      "composer": "Koji Kondo",
      "platform": "NES",
      "year": 1986
    },
    {
      "id": "004",
      "title": "One-Winged Angel",
      "game": "Final Fantasy VII",
      "series": "Final Fantasy",
      "composer": "Nobuo Uematsu",
      "platform": "PlayStation",
      "year": 1997,
      "youtube_url": "https://youtube.com/watch?v=t7wJ8pE2qKU",
      "spotify_url": "https://open.spotify.com/track/0yDKn48Z6TRJdOKKvhqUhE"
    },
    {
      "id": "005",
      "title": "Chemical Plant Zone",
      "game": "Sonic the Hedgehog 2",
      "series": "Sonic",
      "composer": "Masato Nakamura",
      "platform": "Genesis",
      "year": 1992
    },
    {
      "id": "006",
      "title": "Gusty Garden Galaxy",
      "game": "Super Mario Galaxy",
      "series": "Mario",
      "composer": "Mahito Yokota",
      "platform": "Wii",
      "year": 2007,
      "youtube_url": "https://youtube.com/watch?v=VEIWhy-urqM"
    },
    {
      "id": "007",
      "title": "Gerudo Valley",
      "game": "The Legend of Zelda: Ocarina of Time",
      "series": "Zelda",
      "composer": "Koji Kondo",
      "platform": "N64",
      "year": 1998,
      "youtube_url": "https://youtube.com/watch?v=0hEYvdMoF2g"
    },
    {
      "id": "008",
      "title": "To Zanarkand",
      "game": "Final Fantasy X",
      "series": "Final Fantasy",
      "composer": "Nobuo Uematsu",
      "platform": "PlayStation 2",
      "year": 2001,
      "spotify_url": "https://open.spotify.com/track/6XZoJcAY9V1ngXVCZoNjHi"
    },
    {
      "id": "009",
      "title": "Mega Man 2 - Dr. Wily's Castle",
      "game": "Mega Man 2",
      "series": "Mega Man",
      "composer": "Takashi Tateishi",
      "platform": "NES",
      "year": 1988,
      "youtube_url": "https://youtube.com/watch?v=WJRoRt155mA"
    },
    {
      "id": "010",
      "title": "Bloody Tears",
      "game": "Castlevania II: Simon's Quest",
      "series": "Castlevania",
      "composer": "Kenichi Matsubara",
      "platform": "NES",
      "year": 1987
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

```typescript
import { readFile } from 'fs/promises'
import { z } from 'zod'

const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  game: z.string().min(1),
  series: z.string().optional(),
  composer: z.string().optional(),
  platform: z.string().optional(),
  year: z.number().min(1980).max(2030).optional(),
  youtube_url: z.string().url().optional(),
  spotify_url: z.string().url().optional(),
})

const CuratedDataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  tracks: z.array(TrackSchema).min(10),
})

async function validateCurated(filePath: string): Promise<void> {
  const json = JSON.parse(await readFile(filePath, 'utf-8'))
  const result = CuratedDataSchema.safeParse(json)

  if (!result.success) {
    console.error('❌ Validation failed:')
    console.error(result.error.format())
    process.exit(1)
  }

  console.log('✅ Validation passed!')
  console.log(`   Version: ${result.data.version}`)
  console.log(`   Tracks: ${result.data.tracks.length}`)

  // Check for duplicate IDs
  const ids = result.data.tracks.map((t) => t.id)
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length > 0) {
    console.error('❌ Duplicate IDs found:', duplicates)
    process.exit(1)
  }

  // Check for duplicate games (should have variety)
  const games = result.data.tracks.map((t) => t.game)
  const uniqueGames = new Set(games)
  if (uniqueGames.size < games.length * 0.8) {
    console.warn('⚠️  Low game variety (many duplicates)')
  }

  console.log(`   Unique games: ${uniqueGames.size}`)
}

validateCurated('./data/curated.json')
```

### Usage

```bash
cd workers
npm run validate:curated
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

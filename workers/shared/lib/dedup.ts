export interface CandidateTrackId {
  externalId?: string
  youtubeId?: string
  spotifyId?: string
  appleId?: string
  youtubeUrl?: string
  spotifyUrl?: string
  appleMusicUrl?: string
}

export interface CandidateTrackMeta {
  title?: string
  game?: string
  composer?: string
}

export interface DedupKeys {
  externalId?: string
  youtubeId?: string
  spotifyId?: string
  appleId?: string
  compositeKey?: string
  fuzzyKey?: string
}

/**
 * Normalize string for dedup comparison
 */
function normalize(text?: string): string | undefined {
  if (!text) return undefined
  return text
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-') // various dashes
    .replace(/[^a-z0-9ア-ンァ-ンヴー一-龠々ー]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseYouTubeIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '') || undefined
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      // playlist or other paths not handled here
    }
  } catch {
    return undefined
  }
  return undefined
}

export function parseSpotifyIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    return parts.pop() || parts.pop() // handle trailing slash
  } catch {
    return undefined
  }
}

export function parseAppleIdFromUrl(url?: string): { albumId?: string; trackId?: string } {
  if (!url) return {}
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    const albumId = parts.pop() || parts.pop() // /album/<name>/<albumId>
    const trackId = u.searchParams.get('i') || undefined // ?i=<trackId>
    return { albumId: albumId || undefined, trackId }
  } catch {
    return {}
  }
}

export function buildCompositeKey(meta: CandidateTrackMeta): string | undefined {
  const title = normalize(meta.title)
  const game = normalize(meta.game)
  const composer = normalize(meta.composer)
  if (!title || !game || !composer) return undefined
  return `${title}::${game}::${composer}`
}

export function buildGroupKey(meta: CandidateTrackMeta): string | undefined {
  const game = normalize(meta.game)
  const composer = normalize(meta.composer)
  if (!game || !composer) return undefined
  return `${game}::${composer}`
}

export function buildFuzzyKey(meta: CandidateTrackMeta): string | undefined {
  const title = normalize(meta.title)
  if (!title) return undefined
  return title
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

const FUZZY_THRESHOLD_RATIO = 0.12

export function isFuzzyNearDuplicate(target: string, pool: Iterable<string>): boolean {
  for (const candidate of pool) {
    const distance = levenshteinDistance(target, candidate)
    const maxLen = Math.max(target.length, candidate.length)
    if (maxLen === 0) continue
    const ratio = distance / maxLen
    if (ratio <= FUZZY_THRESHOLD_RATIO) return true
  }
  return false
}

/**
 * Build dedup keys from candidate metadata and URLs/IDs.
 */
export function buildDedupKeys(ids: CandidateTrackId, meta: CandidateTrackMeta = {}): DedupKeys {
  const youtubeId = ids.youtubeId ?? parseYouTubeIdFromUrl(ids.youtubeUrl)
  const spotifyId = ids.spotifyId ?? parseSpotifyIdFromUrl(ids.spotifyUrl)
  const appleParsed = parseAppleIdFromUrl(ids.appleMusicUrl)
  // Use per-track id when available; avoid collapsing whole albums into one key
  const appleId = ids.appleId ?? appleParsed.trackId

  return {
    externalId: ids.externalId,
    youtubeId,
    spotifyId,
    appleId,
    compositeKey: buildCompositeKey(meta),
    fuzzyKey: buildFuzzyKey(meta),
  }
}

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
  }
}

import { buildDedupKeys, buildCompositeKey } from '../../../shared/lib/dedup'
import { evaluateGuard, type GuardEvaluationInput } from '../../../shared/lib/intake'
import { logEvent } from '../../../shared/lib/observability'
import type { Env } from '../../../shared/types/env'

export interface Candidate {
  id?: string // external id if known
  title?: string
  game?: string
  composer?: string
  youtubeUrl?: string
  spotifyUrl?: string
  appleMusicUrl?: string
  durationSec?: number
  isrc?: string
  lufs?: number
  silenceRatio?: number
  clipRatio?: number
}

export interface GuardDedupResult {
  passed: Candidate[]
  failedGuard: Array<{ candidate: Candidate; reasons: string[] }>
  duplicates: Array<{ candidate: Candidate; reason: string }>
  stats: {
    total: number
    guardPass: number
    guardFail: number
    duplicates: number
  }
}

interface ExistingKeySets {
  externalIds: Set<string>
  youtubeIds: Set<string>
  spotifyIds: Set<string>
  appleIds: Set<string>
  composite: Set<string>
}

function parseId(id?: string): string | undefined {
  return id?.trim() || undefined
}

async function loadExistingKeys(env: Env): Promise<ExistingKeySets> {
  const rows = await env.DB.prepare(
    `SELECT external_id, youtube_url, spotify_url, apple_music_url, title, game, composer
     FROM tracks_normalized`,
  ).all<{
    external_id: string | null
    youtube_url: string | null
    spotify_url: string | null
    apple_music_url: string | null
    title: string | null
    game: string | null
    composer: string | null
  }>()

  const externalIds = new Set<string>()
  const youtubeIds = new Set<string>()
  const spotifyIds = new Set<string>()
  const appleIds = new Set<string>()
  const composite = new Set<string>()

  if (rows && Array.isArray(rows.results)) {
    for (const row of rows.results) {
      if (row.external_id) externalIds.add(row.external_id)
      const ytId = row.youtube_url ? extractId(row.youtube_url) : undefined
      const spId = row.spotify_url ? extractId(row.spotify_url) : undefined
      const apId = row.apple_music_url ? extractId(row.apple_music_url) : undefined
      if (ytId) youtubeIds.add(ytId)
      if (spId) spotifyIds.add(spId)
      if (apId) appleIds.add(apId)
      const compositeKey = buildCompositeKey({
        title: row.title ?? undefined,
        game: row.game ?? undefined,
        composer: row.composer ?? undefined,
      })
      if (compositeKey) composite.add(compositeKey)
    }
  }

  return { externalIds, youtubeIds, spotifyIds, appleIds, composite }
}

function extractId(url: string): string | undefined {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu')) {
      const v = u.searchParams.get('v')
      if (v) return v
      return u.pathname.replace('/', '') || undefined
    }
    if (u.hostname.includes('spotify.com')) {
      const parts = u.pathname.split('/')
      return parts.pop() || parts.pop()
    }
    if (u.hostname.includes('apple.com')) {
      // Apple Music dedup should key by track, not album
      const trackId = u.searchParams.get('i')
      if (trackId) return trackId
      return undefined
    }
  } catch {
    return undefined
  }
  return undefined
}

export async function guardAndDedup(
  env: Env,
  candidates: Candidate[],
  stageOverride?: string,
): Promise<GuardDedupResult> {
  const existing = await loadExistingKeys(env)
  const stage = stageOverride || env.INTAKE_STAGE || 'staging'
  const seenBatchKeys: ExistingKeySets = {
    externalIds: new Set(),
    youtubeIds: new Set(),
    spotifyIds: new Set(),
    appleIds: new Set(),
    composite: new Set(),
  }

  const passed: Candidate[] = []
  const failedGuard: Array<{ candidate: Candidate; reasons: string[] }> = []
  const duplicates: Array<{ candidate: Candidate; reason: string }> = []

  for (const c of candidates) {
    const guardInput: GuardEvaluationInput = {
      meta: {
        title: c.title,
        game: c.game,
        composer: c.composer,
        isrc: c.isrc,
        durationSec: c.durationSec,
      },
      audio: {
        lufs: c.lufs,
        silenceRatio: c.silenceRatio,
        clipRatio: c.clipRatio,
      },
    }
    const evaluation = evaluateGuard(guardInput, { stage })
    if (!evaluation.pass) {
      failedGuard.push({ candidate: c, reasons: evaluation.reasons })
      continue
    }

    const keys = buildDedupKeys(
      {
        externalId: parseId(c.id),
        youtubeUrl: c.youtubeUrl,
        spotifyUrl: c.spotifyUrl,
        appleMusicUrl: c.appleMusicUrl,
      },
      {
        title: c.title,
        game: c.game,
        composer: c.composer,
      },
    )

    // existing check
    if (
      (keys.externalId && existing.externalIds.has(keys.externalId)) ||
      (keys.youtubeId && existing.youtubeIds.has(keys.youtubeId)) ||
      (keys.spotifyId && existing.spotifyIds.has(keys.spotifyId)) ||
      (keys.appleId && existing.appleIds.has(keys.appleId)) ||
      (keys.compositeKey && existing.composite.has(keys.compositeKey))
    ) {
      duplicates.push({ candidate: c, reason: 'exists_in_db' })
      continue
    }

    // batch-level dedup
    if (
      (keys.externalId && seenBatchKeys.externalIds.has(keys.externalId)) ||
      (keys.youtubeId && seenBatchKeys.youtubeIds.has(keys.youtubeId)) ||
      (keys.spotifyId && seenBatchKeys.spotifyIds.has(keys.spotifyId)) ||
      (keys.appleId && seenBatchKeys.appleIds.has(keys.appleId)) ||
      (keys.compositeKey && seenBatchKeys.composite.has(keys.compositeKey))
    ) {
      duplicates.push({ candidate: c, reason: 'duplicate_in_batch' })
      continue
    }

    // mark as seen
    if (keys.externalId) seenBatchKeys.externalIds.add(keys.externalId)
    if (keys.youtubeId) seenBatchKeys.youtubeIds.add(keys.youtubeId)
    if (keys.spotifyId) seenBatchKeys.spotifyIds.add(keys.spotifyId)
    if (keys.appleId) seenBatchKeys.appleIds.add(keys.appleId)
    if (keys.compositeKey) seenBatchKeys.composite.add(keys.compositeKey)

    passed.push(c)
  }

  logEvent(env, 'info', {
    event: 'intake.guard_dedup',
    status: 'success',
    fields: {
      total: candidates.length,
      guardPass: passed.length,
      guardFail: failedGuard.length,
      duplicates: duplicates.length,
    },
  })

  return {
    passed,
    failedGuard,
    duplicates,
    stats: {
      total: candidates.length,
      guardPass: passed.length,
      guardFail: failedGuard.length,
      duplicates: duplicates.length,
    },
  }
}

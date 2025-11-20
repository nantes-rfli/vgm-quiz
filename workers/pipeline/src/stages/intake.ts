import { isObservabilityEnabled, logEvent, sendSlackNotification } from '../../../shared/lib/observability'
import type { Env } from '../../../shared/types/env'
import { guardAndDedup, type Candidate } from './guard'

interface IntakeResult {
  success: boolean
  skipped?: boolean
  sourcesProcessed: number
  candidatesDiscovered: number
  errors: string[]
}

interface SourceEntry {
  id: string
  provider: 'youtube' | 'spotify' | 'apple'
  kind: 'playlist' | 'channel' | 'artist'
  tier: 'L1' | 'L2' | 'L3'
  name?: string
  active?: boolean
}

export async function handleIntake(env: Env): Promise<IntakeResult> {
  const enabled = env.INTAKE_ENABLED === 'true' || env.INTAKE_ENABLED === '1'
  if (!enabled) {
    logEvent(env, 'info', {
      event: 'intake.skip',
      status: 'success',
      message: 'Intake disabled (INTAKE_ENABLED not set)',
    })
    return { success: true, skipped: true, sourcesProcessed: 0, candidatesDiscovered: 0, errors: [] }
  }

  const errors: string[] = []
  const stage = env.INTAKE_STAGE || 'staging'
  let sourcesProcessed = 0
  let candidatesDiscovered = 0

  logEvent(env, 'info', {
    event: 'intake.start',
    status: 'start',
    fields: { stage },
  })

  // Parse source catalog
  let catalog: SourceEntry[] = []
  if (env.SOURCE_CATALOG_JSON) {
    try {
      const parsed = JSON.parse(env.SOURCE_CATALOG_JSON) as SourceEntry[]
      catalog = parsed.filter((s) => s.active !== false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error'
      errors.push(`catalog: ${message}`)
      logEvent(env, 'error', {
        event: 'intake.error',
        status: 'fail',
        message: 'Failed to parse SOURCE_CATALOG_JSON',
        error,
      })
      return {
        success: false,
        sourcesProcessed,
        candidatesDiscovered,
        errors,
      }
    }
  } else {
    logEvent(env, 'warn', {
      event: 'intake.catalog.missing',
      status: 'fail',
      message: 'SOURCE_CATALOG_JSON not provided; skipping intake',
    })
    return {
      success: true,
      skipped: true,
      sourcesProcessed,
      candidatesDiscovered,
      errors,
    }
  }

  // Optional YouTube intake (discovery only, no storage yet)
  const youtubeKey = env.YOUTUBE_API_KEY
  if (!youtubeKey) {
    logEvent(env, 'warn', {
      event: 'intake.youtube.skip',
      status: 'fail',
      message: 'YOUTUBE_API_KEY not set; skipping YouTube intake',
    })
  }
  const spotifyEnabled = env.SPOTIFY_ENABLED === 'true' || env.SPOTIFY_ENABLED === '1'
  const spotifyId = env.SPOTIFY_CLIENT_ID
  const spotifySecret = env.SPOTIFY_CLIENT_SECRET
  const spotifyMarket = env.SPOTIFY_MARKET || 'US'
  if (spotifyEnabled && (!spotifyId || !spotifySecret)) {
    logEvent(env, 'warn', {
      event: 'intake.spotify.skip',
      status: 'fail',
      message: 'SPOTIFY_ENABLED=true だが Client ID/Secret 不足のため Spotify intake をスキップ',
    })
  }
  const appleEnabled = env.APPLE_ENABLED === 'true' || env.APPLE_ENABLED === '1'
  const appleToken = env.APPLE_MUSIC_TOKEN
  const appleStorefront = env.APPLE_STOREFRONT || 'us'

  // Debug: catalog概要と設定
  const providerCounts = catalog.reduce<Record<string, number>>((acc, cur) => {
    acc[cur.provider] = (acc[cur.provider] || 0) + 1
    return acc
  }, {})
  logEvent(env, 'info', {
    event: 'intake.catalog',
    status: 'info',
    fields: { totalSources: catalog.length, providers: providerCounts },
  })
  logEvent(env, 'info', {
    event: 'intake.config',
    status: 'info',
    fields: {
      youtubeKeyPresent: Boolean(youtubeKey),
      spotifyEnabled,
      spotifyClientPresent: Boolean(spotifyId && spotifySecret),
      spotifyMarket,
    },
  })

  for (const source of catalog) {
    if (source.provider === 'youtube' && source.kind === 'playlist') {
      if (!youtubeKey) continue
      try {
        const { count, candidates } = await fetchYouTubePlaylistItems(source.id, youtubeKey)
        const enriched = candidates.length
          ? await enrichYouTubeMeta(env, candidates, youtubeKey)
          : []
        // fallback: playlist 名を game に入れてメタ欠損を緩和
        for (const c of enriched) {
          if (!c.game && source.name) c.game = source.name
        }
        const stageLabel = stage
        const durationMinStage = stageLabel.toLowerCase().startsWith('prod') ? 30 : 10
        const durationFilteredStage = enriched.filter(
          (c) => c.durationSec === undefined || c.durationSec >= durationMinStage,
        )
        const guardResult =
          durationFilteredStage.length > 0
            ? await guardAndDedup(env, durationFilteredStage, stageLabel)
            : undefined

        if (guardResult?.failedGuard?.length) {
          const reasonsCount: Record<string, number> = {}
          for (const f of guardResult.failedGuard) {
            for (const r of f.reasons) {
              reasonsCount[r] = (reasonsCount[r] || 0) + 1
            }
          }
          logEvent(env, 'warn', {
            event: 'intake.guard_fail',
            status: 'warn',
            message: 'Guard failures detected',
            fields: {
              source: source.name || source.id,
              topReasons: Object.entries(reasonsCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
              samples: guardResult.failedGuard.slice(0, 3).map((f) => ({
                title: f.candidate.title,
                url: f.candidate.youtubeUrl,
                reason: f.reasons.join('; '),
              })),
            },
          })
        }

        sourcesProcessed += 1
        candidatesDiscovered += count
        await maybeAlertOnRates(env, source, guardResult)
        logEvent(env, 'info', {
          event: 'intake.discovery',
          status: 'success',
          fields: {
            source: source.name || source.id,
            provider: source.provider,
            kind: source.kind,
            tier: source.tier,
            items: count,
            stage,
            guardPass: guardResult?.stats.guardPass,
            guardFail: guardResult?.stats.guardFail,
            duplicates: guardResult?.stats.duplicates,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        errors.push(`${source.id}: ${message}`)
        logEvent(env, 'error', {
          event: 'intake.discovery',
          status: 'fail',
          message: `Failed intake for ${source.id}`,
          fields: { source: source.name || source.id, tier: source.tier },
          error,
        })
      }
      continue
    }

    if (source.provider === 'spotify' && source.kind === 'playlist') {
      if (!spotifyEnabled || !spotifyId || !spotifySecret) {
        logEvent(env, 'warn', {
          event: 'intake.spotify.skip',
          status: 'fail',
          message: 'Spotify disabled or credentials missing',
          fields: { source: source.name || source.id },
        })
        continue
      }
      try {
        const { count, candidates } = await fetchSpotifyPlaylistItems(
          source.id,
          spotifyId,
          spotifySecret,
        )
        if (count === 0) {
          logEvent(env, 'warn', {
            event: 'intake.spotify.empty',
            status: 'warn',
            message: 'Spotify playlist returned 0 items',
            fields: { source: source.name || source.id },
          })
          continue
        }
        const guardResult =
          candidates.length > 0 ? await guardAndDedup(env, candidates) : undefined

        sourcesProcessed += 1
        candidatesDiscovered += count
        await maybeAlertOnRates(env, source, guardResult)
        logEvent(env, 'info', {
          event: 'intake.discovery',
          status: 'success',
          fields: {
            source: source.name || source.id,
            provider: source.provider,
            kind: source.kind,
            tier: source.tier,
            items: count,
            stage,
            guardPass: guardResult?.stats.guardPass,
            guardFail: guardResult?.stats.guardFail,
            duplicates: guardResult?.stats.duplicates,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        errors.push(`${source.id}: ${message}`)
        logEvent(env, 'error', {
          event: 'intake.discovery',
          status: 'fail',
          message: `Failed intake for ${source.id}`,
          fields: { source: source.name || source.id, tier: source.tier },
          error,
        })
      }
    }

    if (source.provider === 'apple') {
      if (!appleEnabled || !appleToken) {
        logEvent(env, 'warn', {
          event: 'intake.apple.skip',
          status: 'fail',
          message: 'APPLE_ENABLED=true だが token 不足のため Apple intake をスキップ',
          fields: { source: source.name || source.id },
        })
        continue
      }
      try {
        const { count, candidates } = await fetchApplePlaylistItems(
          source.id,
          appleToken,
          appleStorefront,
        )
        const guardResult =
          candidates.length > 0 ? await guardAndDedup(env, candidates) : undefined

        sourcesProcessed += 1
        candidatesDiscovered += count
        await maybeAlertOnRates(env, source, guardResult)
        logEvent(env, 'info', {
          event: 'intake.discovery',
          status: 'success',
          fields: {
            source: source.name || source.id,
            provider: source.provider,
            kind: source.kind,
            tier: source.tier,
            items: count,
            stage,
            guardPass: guardResult?.stats.guardPass,
            guardFail: guardResult?.stats.guardFail,
            duplicates: guardResult?.stats.duplicates,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        errors.push(`${source.id}: ${message}`)
        logEvent(env, 'error', {
          event: 'intake.discovery',
          status: 'fail',
          message: `Failed intake for ${source.id}`,
          fields: { source: source.name || source.id, tier: source.tier },
          error,
        })
      }
    }

    if (source.provider === 'spotify' && source.kind === 'artist') {
      if (!spotifyEnabled || !spotifyId || !spotifySecret) {
        logEvent(env, 'warn', {
          event: 'intake.spotify.skip',
          status: 'fail',
          message: 'Spotify disabled or credentials missing',
          fields: { source: source.name || source.id },
        })
        continue
      }
      try {
        const { count, candidates } = await fetchSpotifyArtistTopTracks(
          source.id,
          spotifyId,
          spotifySecret,
          spotifyMarket,
        )
        if (count === 0) {
          logEvent(env, 'warn', {
            event: 'intake.spotify.empty',
            status: 'warn',
            message: 'Spotify artist top tracks returned 0 items',
            fields: { source: source.name || source.id, market: spotifyMarket },
          })
          continue
        }
        const stageLabel = stage
        const durationMinStage = stageLabel.toLowerCase().startsWith('prod') ? 30 : 10
        const durationFilteredStage = candidates.filter(
          (c) => c.durationSec === undefined || c.durationSec >= durationMinStage,
        )
        const guardResult =
          durationFilteredStage.length > 0
            ? await guardAndDedup(env, durationFilteredStage, stageLabel)
            : undefined

        sourcesProcessed += 1
        candidatesDiscovered += count
        await maybeAlertOnRates(env, source, guardResult)
        logEvent(env, 'info', {
          event: 'intake.discovery',
          status: 'success',
          fields: {
            source: source.name || source.id,
            provider: source.provider,
            kind: source.kind,
            tier: source.tier,
            items: count,
            stage,
            guardPass: guardResult?.stats.guardPass,
            guardFail: guardResult?.stats.guardFail,
            duplicates: guardResult?.stats.duplicates,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        errors.push(`${source.id}: ${message}`)
        logEvent(env, 'error', {
          event: 'intake.discovery',
          status: 'fail',
          message: `Failed intake for ${source.id}`,
          fields: { source: source.name || source.id, tier: source.tier },
          error,
        })
      }
    }
  }

  const success = errors.length === 0
  logEvent(env, success ? 'info' : 'error', {
    event: 'intake.end',
    status: success ? 'success' : 'fail',
    fields: {
      stage,
      sourcesProcessed,
      candidatesDiscovered,
      errors: errors.slice(0, 5),
    },
  })

  return {
    success,
    sourcesProcessed,
    candidatesDiscovered,
    errors,
  }
}

async function fetchYouTubePlaylistItems(
  playlistId: string,
  apiKey: string,
): Promise<{ count: number; candidates: Candidate[] }> {
  let total = 0
  let pageToken: string | undefined
  const maxPages = 3 // safeguard for PoC
  const candidates: Candidate[] = []

  for (let i = 0; i < maxPages; i++) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      nextPageToken?: string
      items?: unknown[]
    }

    const items = Array.isArray(data.items) ? data.items : []
    total += items.length

    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const snippet = (item as any).snippet
      const title = snippet?.title as string | undefined
      const videoId = snippet?.resourceId?.videoId as string | undefined
      const channelTitle =
        (snippet?.videoOwnerChannelTitle as string | undefined) ||
        (snippet?.channelTitle as string | undefined)

      candidates.push({
        id: videoId,
        title,
        composer: channelTitle,
        youtubeUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
      })
    }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }

  return { count: total, candidates }
}

async function fetchSpotifyPlaylistItems(
  playlistId: string,
  clientId: string,
  clientSecret: string,
): Promise<{ count: number; candidates: Candidate[] }> {
  const token = await getSpotifyToken(clientId, clientSecret)
  const candidates: Candidate[] = []
  let next: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(id,name,artists(name),album(name),duration_ms,external_urls,external_ids,is_local)),next,limit,offset,total&limit=100`
  let total = 0
  let safeguards = 0

  while (next && safeguards < 5) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Spotify API ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = (await res.json()) as {
      items?: Array<{
        track?: {
          id?: string
          name?: string
          duration_ms?: number
          artists?: Array<{ name?: string }>
          album?: { name?: string }
          external_urls?: { spotify?: string }
          external_ids?: { isrc?: string }
          is_local?: boolean
        }
      }>
      next?: string | null
      total?: number
    }
    const items = Array.isArray(data.items) ? data.items : []
    for (const item of items) {
      const track = item?.track
      if (!track || track.is_local) continue
      const title = track.name ?? undefined
      const composer = track.artists?.[0]?.name ?? undefined
      const game = track.album?.name ?? undefined
      candidates.push({
        id: track.id ?? undefined,
        title,
        composer,
        game,
        durationSec: track.duration_ms ? track.duration_ms / 1000 : undefined,
        spotifyUrl: track.external_urls?.spotify,
        isrc: track.external_ids?.isrc ?? undefined,
      })
    }
    total += items.length
    next = data.next ?? null
    safeguards++
  }

  return { count: total, candidates }
}

async function fetchSpotifyArtistTopTracks(
  artistId: string,
  clientId: string,
  clientSecret: string,
  market: string,
): Promise<{ count: number; candidates: Candidate[] }> {
  const token = await getSpotifyToken(clientId, clientSecret)
  const url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${encodeURIComponent(
    market,
  )}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Spotify API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    tracks?: Array<{
      id?: string
      name?: string
      duration_ms?: number
      artists?: Array<{ name?: string }>
      album?: { name?: string }
      external_urls?: { spotify?: string }
      external_ids?: { isrc?: string }
      is_local?: boolean
    }>
  }
  const tracks = Array.isArray(data.tracks) ? data.tracks : []
  const candidates: Candidate[] = []
  for (const t of tracks) {
    if (!t || t.is_local) continue
    candidates.push({
      id: t.id ?? undefined,
      title: t.name ?? undefined,
      composer: t.artists?.[0]?.name ?? undefined,
      game: t.album?.name ?? undefined,
      durationSec: t.duration_ms ? t.duration_ms / 1000 : undefined,
      spotifyUrl: t.external_urls?.spotify,
      isrc: t.external_ids?.isrc ?? undefined,
    })
  }
  return { count: tracks.length, candidates }
}

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spotify token failed ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token: string }
  if (!data.access_token) {
    throw new Error('Spotify token response missing access_token')
  }
  return data.access_token
}

async function fetchApplePlaylistItems(
  playlistId: string,
  token: string,
  storefront: string,
): Promise<{ count: number; candidates: Candidate[] }> {
  // playlistId expects the Apple Music catalog id (e.g., pl.12345)
  const url = new URL(
    `https://api.music.apple.com/v1/catalog/${storefront}/playlists/${playlistId}`,
  )
  url.searchParams.set('include', 'tracks')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Apple Music API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    data?: Array<{
      relationships?: {
        tracks?: {
          data?: Array<{
            id?: string
            attributes?: {
              name?: string
              albumName?: string
              composerName?: string
              durationInMillis?: number
              isrc?: string
              url?: string
            }
          }>
        }
      }
    }>
  }

  const list = data.data?.[0]?.relationships?.tracks?.data || []
  const candidates: Candidate[] = []
  for (const item of list) {
    const attr = item.attributes
    if (!attr) continue
    candidates.push({
      id: item.id,
      title: attr.name,
      game: attr.albumName,
      composer: attr.composerName,
      durationSec: attr.durationInMillis ? attr.durationInMillis / 1000 : undefined,
      appleMusicUrl: attr.url,
      isrc: attr.isrc,
    })
  }

  return { count: list.length, candidates }
}

async function maybeAlertOnRates(
  env: Env,
  source: { id: string; name?: string },
  guardResult?: Awaited<ReturnType<typeof guardAndDedup>>,
): Promise<void> {
  if (!guardResult || !isObservabilityEnabled(env)) return
  const total = guardResult.stats.total || 1
  const guardFailRate = guardResult.stats.guardFail / total
  const duplicateRate = guardResult.stats.duplicates / total

  const warn =
    guardFailRate >= 0.2 || duplicateRate >= 0.2

  if (!warn) return

  await sendSlackNotification(env, '【vgm-quiz】Intake guard/dup high rate', {
    source: source.name || source.id,
    guardFailRate: guardFailRate.toFixed(2),
    duplicateRate: duplicateRate.toFixed(2),
    total,
  })
}

async function enrichYouTubeMeta(
  env: Env,
  candidates: Candidate[],
  apiKey: string,
): Promise<Candidate[]> {
  const byId = new Map<string, Candidate>()
  for (const c of candidates) {
    if (c.id) byId.set(c.id, c)
  }

  const ids = Array.from(byId.keys())
  const chunkSize = 50
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'contentDetails,snippet')
    url.searchParams.set('id', chunk.join(','))
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      logEvent(env, 'warn', {
        event: 'intake.youtube.enrich',
        status: 'fail',
        message: `YouTube videos API ${res.status}: ${body.slice(0, 120)}`,
      })
      continue
    }
    const data = (await res.json()) as {
      items?: Array<{
        id?: string
        contentDetails?: { duration?: string }
        snippet?: { title?: string; channelTitle?: string }
      }>
    }
    for (const item of data.items || []) {
      if (!item?.id) continue
      const target = byId.get(item.id)
      if (!target) continue
      const dur = item.contentDetails?.duration
      if (dur) {
        target.durationSec = iso8601DurationToSeconds(dur)
      }
      // keep title/snippet fallback; channelTitle may help later
      if (!target.composer && item.snippet?.channelTitle) {
        target.composer = item.snippet.channelTitle
      }
    }
  }
  return candidates
}

function iso8601DurationToSeconds(duration: string): number | undefined {
  // Simple parser for PT#H#M#S
  const match =
    /P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(duration)
  if (!match) return undefined
  const hours = match[1] ? parseInt(match[1], 10) : 0
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const seconds = match[3] ? parseFloat(match[3]) : 0
  return hours * 3600 + minutes * 60 + seconds
}

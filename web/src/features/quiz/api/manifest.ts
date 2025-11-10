'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

// Manifest API types for Phase 2B
// Describes available quiz modes, facets, and features

export type Difficulty = 'easy' | 'normal' | 'hard' | 'mixed'
export type Era = '80s' | '90s' | '00s' | '10s' | '20s' | 'mixed'

export interface Mode {
  id: string // e.g., 'vgm_v1-ja'
  title: string // e.g., 'VGM Quiz Vol.1 (JA)'
  defaultTotal: number // e.g., 10
}

export interface Facets {
  difficulty: Difficulty[]
  era: Era[]
  series: string[] // e.g., ['ff', 'dq', 'zelda', 'mario', 'sonic', 'pokemon', 'mixed']
}

export interface Features {
  inlinePlaybackDefault: boolean
  imageProxyEnabled: boolean
}

export interface Manifest {
  schema_version: number // e.g., 2
  modes: Mode[]
  facets: Facets
  features: Features
}

// Request types for filtered rounds
export interface RoundStartRequest {
  mode?: string // defaults to first mode in manifest
  difficulty?: Difficulty
  era?: Era
  series?: string[] // Can be multiple, OR'd together
  total?: number // defaults to mode.defaultTotal
  seed?: string // For deterministic shuffling
}

export interface RoundStartParams {
  difficulty?: string
  era?: string
  series?: string | string[] // Can be query param repeated multiple times
  total?: string
  seed?: string
}

// Manifest caching configuration
const MANIFEST_STORAGE_KEY = 'vgm2.manifest.cache'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

interface CachedManifest {
  data: Manifest
  timestamp: number
  version: number // schema_version for change detection
}

// Default manifest fallback - used only if all other sources fail
const DEFAULT_MANIFEST: Manifest = {
  schema_version: 2,
  modes: [
    {
      id: 'vgm_v1-ja',
      title: 'VGM Quiz Vol.1 (JA)',
      defaultTotal: 10,
    },
  ],
  facets: {
    difficulty: ['easy', 'normal', 'hard', 'mixed'],
    era: ['80s', '90s', '00s', '10s', '20s', 'mixed'],
    series: ['ff', 'dq', 'zelda', 'mario', 'sonic', 'pokemon', 'mixed'],
  },
  features: {
    inlinePlaybackDefault: false,
    imageProxyEnabled: false,
  },
}

/**
 * Fetch Manifest from API endpoint
 * Throws on error to enable React Query retry mechanisms
 * Callers should use initialData/select for fallback
 */
export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch('/v1/manifest')
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest: ${res.status}`)
  }
  const data = (await res.json()) as Manifest

  // Save to localStorage for offline fallback
  const cached: CachedManifest = {
    data,
    timestamp: Date.now(),
    version: data.schema_version,
  }
  localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(cached))

  return data
}

/**
 * Load cached Manifest from localStorage
 * Returns null only if cache is invalid (too old or corrupted)
 */
function loadManifestFromStorage(): CachedManifest | null {
  try {
    const stored = localStorage.getItem(MANIFEST_STORAGE_KEY)
    if (!stored) return null

    const parsed: CachedManifest = JSON.parse(stored)
    const age = Date.now() - parsed.timestamp

    // Invalidate cache if older than 24 hours
    if (age > CACHE_MAX_AGE) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * Get stored Manifest version for change detection
 */
function getStoredManifestVersion(): number | null {
  const cached = loadManifestFromStorage()
  return cached?.version ?? null
}

/**
 * React Query hook for Manifest with caching and version-aware update strategy
 *
 * Strategy:
 * 1. Load from cache on mount (cache-first)
 * 2. Always refetch on mount to detect schema_version changes
 * 3. On successful fetch, compare schema_version and invalidate if changed
 * 4. Auto-refetch every 5 minutes and on network reconnect
 * 5. On failure, fallback to cached data or DEFAULT_MANIFEST
 * 6. UI receives data that is always non-null (never loading state)
 */
export function useManifest() {
  const queryClient = useQueryClient()
  const cachedVersion = getStoredManifestVersion()

  // Select with version change detection
  const selectManifest = useCallback(
    (data: Manifest) => {
      // Detect schema_version changes and invalidate cache
      if (cachedVersion !== null && data.schema_version !== cachedVersion) {
        // Version changed - schedule invalidation (non-blocking)
        Promise.resolve().then(() => {
          queryClient.invalidateQueries({ queryKey: ['manifest'] })
        })
      }
      // Ensure data is never undefined
      return data ?? DEFAULT_MANIFEST
    },
    [cachedVersion, queryClient]
  )

  return useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    // Use cached data as initial data to prevent loading state
    initialData: loadManifestFromStorage()?.data ?? DEFAULT_MANIFEST,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    // Always validate manifest on mount to detect schema_version changes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // Refetch every 5 minutes to catch schema_version updates
    refetchInterval: 1000 * 60 * 5,
    // Refetch when network comes back online
    refetchOnReconnect: true,
    // Let React Query handle errors (retry with backoff)
    throwOnError: false,
    // Select with version change detection and fallback
    select: selectManifest,
  })
}

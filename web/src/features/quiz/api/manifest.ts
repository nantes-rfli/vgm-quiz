'use client'

import { useQuery } from '@tanstack/react-query'

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
 * React Query hook for Manifest with robust caching strategy
 *
 * Strategy:
 * 1. Load from cache on mount (cache-first) to prevent loading state
 * 2. Refetch on mount to validate cache
 * 3. Auto-refetch every 5 minutes to catch schema_version updates
 * 4. Refetch on network reconnection to sync with latest data
 * 5. On failure, fallback to cached data or DEFAULT_MANIFEST via React Query retry
 * 6. UI always receives non-null Manifest (never undefined)
 */
export function useManifest() {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    // Use cached data as initial data to prevent loading state
    initialData: loadManifestFromStorage()?.data ?? DEFAULT_MANIFEST,
    // Mark initialData as stale so refetchOnMount will trigger immediately
    // This ensures first-time visitors (no cache) fetch /v1/manifest right away
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    // Always validate manifest on mount - will refetch because initialDataUpdatedAt: 0
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // Refetch every 5 minutes to catch schema_version updates
    refetchInterval: 1000 * 60 * 5,
    // Refetch when network comes back online
    refetchOnReconnect: true,
    // Let React Query handle errors (retry with backoff)
    throwOnError: false,
    // Ensure data is never undefined (fallback to DEFAULT_MANIFEST)
    select: (data) => data ?? DEFAULT_MANIFEST,
  })
}

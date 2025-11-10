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
const MANIFEST_VERSION_KEY = 'vgm2.manifest.version'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

interface CachedManifest {
  data: Manifest
  timestamp: number
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
  }
  localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(cached))
  localStorage.setItem(MANIFEST_VERSION_KEY, String(data.schema_version))

  return data
}

/**
 * Load cached Manifest from localStorage
 */
function loadManifestFromStorage(): Manifest | null {
  try {
    const stored = localStorage.getItem(MANIFEST_STORAGE_KEY)
    if (!stored) return null

    const parsed: CachedManifest = JSON.parse(stored)
    const age = Date.now() - parsed.timestamp

    // Invalidate cache if older than 24 hours
    if (age > CACHE_MAX_AGE) return null

    return parsed.data
  } catch {
    return null
  }
}

/**
 * React Query hook for Manifest with caching and fallback strategy
 * - Cache-first strategy: uses localStorage if available
 * - Falls back to DEFAULT_MANIFEST if API fails
 * - Automatically saves to localStorage on successful fetch
 */
export function useManifest() {
  const initialData = loadManifestFromStorage()

  return useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    initialData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: !initialData, // Only refetch if no initial data
    refetchOnWindowFocus: false,
    throwOnError: false, // Don't throw on error, use fallback instead
    select: (data) => data ?? DEFAULT_MANIFEST, // Use DEFAULT_MANIFEST if data is undefined
  })
}

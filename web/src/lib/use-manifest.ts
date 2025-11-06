'use client'

import { useState, useEffect } from 'react'
import type { Manifest } from '@/src/features/quiz/api/manifest'

const MANIFEST_CACHE_KEY = 'vgm2.manifest.cache'
const MANIFEST_VERSION_KEY = 'vgm2.manifest.version'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

interface CachedManifest {
  data: Manifest
  timestamp: number
}

// Default manifest for fallback - ONLY used if all other sources fail
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

export function useManifest() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        // Step 1: Try to load from cache first (cache-first strategy)
        const cached = localStorage.getItem(MANIFEST_CACHE_KEY)
        if (cached) {
          try {
            const parsed: CachedManifest = JSON.parse(cached)
            const age = Date.now() - parsed.timestamp
            if (age < CACHE_MAX_AGE) {
              setManifest(parsed.data)
              setIsLoading(false)
              setError(null)
              // Continue fetching in background to update cache
              // (don't await, let it update asynchronously)
              fetchAndUpdateCache()
              return
            }
          } catch {
            // Invalid cache, continue to network fetch
          }
        }

        // Step 2: Fetch from network if no valid cache
        setIsLoading(true)
        setError(null)
        const data = await fetchFromNetwork()
        if (data) {
          setManifest(data)
          setError(null)
        }
      } catch (err) {
        // Step 3: Fall back to DEFAULT_MANIFEST if all else fails
        setManifest(DEFAULT_MANIFEST)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    const fetchFromNetwork = async (): Promise<Manifest | null> => {
      try {
        const res = await fetch('/v1/manifest', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch manifest: ${res.status}`)
        }

        const data = (await res.json()) as Manifest

        // Save to cache
        const cached: CachedManifest = {
          data,
          timestamp: Date.now(),
        }
        localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(cached))
        localStorage.setItem(MANIFEST_VERSION_KEY, String(data.schema_version))

        return data
      } catch (err) {
        throw err
      }
    }

    const fetchAndUpdateCache = async () => {
      try {
        await fetchFromNetwork()
        // Update state with fresh data after cache is updated
        const cached = localStorage.getItem(MANIFEST_CACHE_KEY)
        if (cached) {
          const parsed: CachedManifest = JSON.parse(cached)
          setManifest(parsed.data)
        }
      } catch {
        // Ignore background fetch errors, keep using cache
      }
    }

    fetchManifest()
  }, [])

  return { manifest, isLoading, error }
}

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

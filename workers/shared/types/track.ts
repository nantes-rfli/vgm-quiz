export type Difficulty = 'easy' | 'normal' | 'hard'
export type Era = '80s' | '90s' | '00s' | '10s' | '20s'

export interface Track {
  id: string // Stored as tracks_normalized.external_id
  title: string
  game: string
  series?: string
  composer?: string
  platform?: string
  year?: number
  youtube_url?: string
  spotify_url?: string
  // Phase 2A: Extended metadata for filtering
  difficulty?: Difficulty
  genres?: string[] // e.g., ["action", "rpg", "platformer"]
  seriesTags?: string[] // e.g., ["ff", "dq", "zelda", "mario"]
  era?: Era
}

export interface CuratedData {
  version: string
  tracks: Track[]
}

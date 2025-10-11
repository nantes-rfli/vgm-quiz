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
}

export interface CuratedData {
  version: string
  tracks: Track[]
}

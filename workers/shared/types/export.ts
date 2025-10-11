import type { Track } from './track'

export interface Choice {
  id: string
  text: string
  correct: boolean
}

export interface Reveal {
  title: string
  game: string
  composer?: string
  year?: number
  platform?: string
  series?: string
  youtube_url?: string
  spotify_url?: string
}

export interface Question {
  id: string
  track_id: number
  title: string
  game: string
  choices: Choice[]
  reveal: Reveal
  meta?: {
    difficulty?: number
    notability?: number
    quality?: number
  }
}

export interface DailyExport {
  meta: {
    date: string
    version: string
    generated_at: string
    hash: string
  }
  questions: Question[]
}

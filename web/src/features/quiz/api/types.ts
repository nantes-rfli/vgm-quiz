// Schema-aligned types (UPDATED: round.progress in round, finished top-level)
export type ID = string;

export interface Choice { id: ID; label: string; }

export interface RevealLink {
  provider: 'youtube' | 'appleMusic' | 'spotify' | 'other';
  url: string;
  label?: string;
}

export interface RevealMeta {
  workTitle?: string;
  trackTitle?: string;
  composer?: string;
}

export interface Reveal {
  links?: RevealLink[];
  questionId?: ID;
  choiceId?: ID;
  correct?: boolean;
  correctChoiceId?: ID;
  meta?: RevealMeta;
}

export interface Artwork {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface Question {
  id: ID;
  prompt: string;
  choices: Choice[];
  reveal?: Reveal;
  artwork?: Artwork;
}

export interface Progress { index: number; total: number; }

export interface RoundMeta {
  token: string;
  progress: Progress;
}

export interface RoundsStartResponse {
  round: RoundMeta;
  finished: boolean;
  question: Question;
  reveal?: Reveal;
}

export interface RoundsNextResponse {
  round: RoundMeta;
  finished: boolean;
  question?: Question; // omitted when finished === true
  reveal?: Reveal;
}

// ============================================================================
// Phase 1 API Types (Current Backend Implementation)
// ============================================================================
// These types match the actual Phase 1 Workers implementation
// See: workers/api/src/routes/rounds.ts

export interface Phase1Question {
  id: string;
  title: string;
}

export interface Phase1Choice {
  id: string;
  text: string;
}

export interface Phase1Reveal {
  title: string;
  game: string;
  composer?: string;
  year?: number;
  platform?: string;
  series?: string;
  youtube_url?: string;
  spotify_url?: string;
  apple_music_url?: string;
  other_url?: string; // For unsupported/fallback providers
}

export interface Phase1StartResponse {
  question: Phase1Question;
  choices: Phase1Choice[];
  continuationToken: string;
}

export interface Phase1NextResponse {
  result: {
    correct: boolean;
    correctAnswer: string;
    reveal: Phase1Reveal;
  };
  question?: Phase1Question;
  choices?: Phase1Choice[];
  continuationToken?: string;
  finished: boolean;
}

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

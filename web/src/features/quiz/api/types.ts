// Schema-aligned types for quiz API (CONTRACT-ALIGN-01)
// Path: web/src/features/quiz/api/types.ts

export type ID = string;

export interface Choice {
  id: ID;
  label: string;
}

export interface Artwork {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface RevealLink {
  provider: string;
  url: string;
}

export interface Reveal {
  links?: RevealLink[];
}

export interface Question {
  id: ID;
  prompt: string;
  choices: Choice[];
  artwork?: Artwork;
  reveal?: Reveal;
}

export interface Progress {
  index: number;
  total: number;
}

export interface RoundsStartResponse {
  token: string;
  max: number;
  question: Question;
  progress?: Progress;
}

export interface RoundsNextResponse {
  token: string;
  finished?: boolean;
  question?: Question; // omitted when finished === true
  progress?: Progress;
}

export interface MetricsRequest {
  token: string;
  questionId: string;
  choiceId: string;
  correct?: boolean;
  latencyMs?: number;
  answeredAt?: string; // ISO8601
  extras?: {
    device?: string;
    userAgent?: string;
  };
}

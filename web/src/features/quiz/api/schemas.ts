import { z } from 'zod'
import type { Phase1Choice, Phase1Question, Phase1Reveal, Phase1StartResponse, Phase1NextResponse } from './types'

const DIFFICULTY_VALUES = ['easy', 'normal', 'hard', 'mixed'] as const
const ERA_VALUES = ['80s', '90s', '00s', '10s', '20s', 'mixed'] as const

export const DifficultySchema = z.enum(DIFFICULTY_VALUES)
export type Difficulty = (typeof DIFFICULTY_VALUES)[number]

export const EraSchema = z.enum(ERA_VALUES)
export type Era = (typeof ERA_VALUES)[number]

export const ModeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  defaultTotal: z.number().int().min(1).max(100),
})

export const FacetsSchema = z.object({
  difficulty: z.array(DifficultySchema).nonempty(),
  era: z.array(EraSchema).nonempty(),
  series: z.array(z.string().min(1)).nonempty(),
})

export const FeaturesSchema = z.object({
  inlinePlaybackDefault: z.boolean(),
  imageProxyEnabled: z.boolean(),
})

export const ManifestSchema = z.object({
  schema_version: z.number().int().nonnegative(),
  modes: z.array(ModeSchema).nonempty(),
  facets: FacetsSchema,
  features: FeaturesSchema,
})

export type Mode = z.infer<typeof ModeSchema>
export type Facets = z.infer<typeof FacetsSchema>
export type Features = z.infer<typeof FeaturesSchema>
export type Manifest = z.infer<typeof ManifestSchema>

const RoundProgressSchema = z.object({
  index: z.number().int().min(0),
  total: z.number().int().min(1),
})

const Phase1ChoiceSchema: z.ZodType<Phase1Choice> = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
})

const Phase1QuestionSchema: z.ZodType<Phase1Question> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
})

const Phase1RevealSchema: z.ZodType<Phase1Reveal> = z.object({
  title: z.string().min(1),
  game: z.string().min(1),
  composer: z.string().optional(),
  year: z.number().int().optional(),
  platform: z.string().optional(),
  series: z.string().optional(),
  youtube_url: z.string().url().optional(),
  spotify_url: z.string().url().optional(),
  apple_music_url: z.string().url().optional(),
  other_url: z.string().url().optional(),
})

export const Phase1StartResponseSchema: z.ZodType<Phase1StartResponse> = z.object({
  question: Phase1QuestionSchema,
  choices: z.array(Phase1ChoiceSchema).min(1),
  continuationToken: z.string().min(1),
  progress: RoundProgressSchema.optional(),
  round: z
    .object({
      id: z.string().min(1),
      mode: z.string().min(1),
      date: z.string().min(1),
      filters: z.record(z.string(), z.unknown()).optional(),
      progress: RoundProgressSchema,
      token: z.string().min(1),
    })
    .optional(),
})

export const Phase1NextResponseSchema: z.ZodType<Phase1NextResponse> = z.object({
  result: z.object({
    correct: z.boolean(),
    correctAnswer: z.string().min(1),
    reveal: Phase1RevealSchema,
  }),
  question: Phase1QuestionSchema.optional(),
  choices: z.array(Phase1ChoiceSchema).optional(),
  continuationToken: z.string().optional(),
  progress: RoundProgressSchema.optional(),
  finished: z.boolean(),
})

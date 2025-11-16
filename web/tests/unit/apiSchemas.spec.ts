import { describe, expect, it } from 'vitest'

import { ManifestSchema, Phase1NextResponseSchema, Phase1StartResponseSchema } from '@/src/features/quiz/api/schemas'

const baseStartResponse = {
  question: { id: 'q-1', title: 'Question 1' },
  choices: [
    { id: 'c-1', text: 'Option 1' },
    { id: 'c-2', text: 'Option 2' },
  ],
  continuationToken: 'token-123',
  progress: { index: 1, total: 10 },
}

const baseNextResponse = {
  result: {
    correct: true,
    correctAnswer: 'c-1',
    reveal: {
      title: 'Track',
      game: 'Game',
    },
  },
  finished: false,
}

const baseManifest = {
  schema_version: 2,
  modes: [{ id: 'vgm_v1-ja', title: 'Vol 1', defaultTotal: 10 }],
  facets: {
    difficulty: ['easy', 'normal', 'hard', 'mixed'],
    era: ['80s', '90s'],
    series: ['ff'],
  },
  features: {
    inlinePlaybackDefault: false,
    imageProxyEnabled: false,
  },
}

describe('API schemas', () => {
  it('accepts valid Phase1 start response and rejects malformed payloads', () => {
    expect(() => Phase1StartResponseSchema.parse(baseStartResponse)).not.toThrow()

    const invalid = { ...baseStartResponse }
    delete (invalid as { continuationToken?: string }).continuationToken
    expect(Phase1StartResponseSchema.safeParse(invalid).success).toBe(false)
  })

  it('validates Phase1 next responses', () => {
    expect(() => Phase1NextResponseSchema.parse(baseNextResponse)).not.toThrow()

    const invalid = {
      ...baseNextResponse,
      result: {
        ...baseNextResponse.result,
        correctAnswer: '',
      },
    }

    expect(Phase1NextResponseSchema.safeParse(invalid).success).toBe(false)
  })

  it('ensures manifest responses include required facets', () => {
    expect(() => ManifestSchema.parse(baseManifest)).not.toThrow()

    const invalidManifest = {
      ...baseManifest,
      facets: {
        ...baseManifest.facets,
        series: [],
      },
    }

    expect(ManifestSchema.safeParse(invalidManifest).success).toBe(false)
  })
})

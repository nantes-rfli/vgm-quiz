import { beforeEach, describe, expect, it } from 'vitest';

import type { Question, Reveal } from '@/src/features/quiz/api/types';
import { enrichReveal, toQuestionRecord } from '@/src/features/quiz/lib/reveal';
import { RevealSchema } from '@/src/features/quiz/lib/revealSchemas';
import type { Outcome } from '@/src/lib/resultStorage';
import { appendReveal, clearReveals, loadLastReveal, loadReveals } from '@/src/lib/resultStorage';

const baseQuestion: Question = {
  id: 'q-1',
  prompt: 'Sample prompt',
  choices: [
    { id: 'a', label: 'Option A' },
    { id: 'b', label: 'Option B' },
  ],
  reveal: {
    links: [{ provider: 'youtube', url: 'https://youtube.com/watch?v=test' }],
    meta: { workTitle: 'Work', composer: 'Composer' },
  },
};

describe('reveal contracts', () => {
  beforeEach(() => {
    clearReveals();
  });

  it('enriches reveal data by preferring latest values', () => {
    const previous: Reveal = {
      links: [{ provider: 'spotify', url: 'https://open.spotify.com/track/test' }],
      meta: { trackTitle: 'Track from fallback' },
    };
    const fromNext: Reveal = {
      links: [],
      meta: { trackTitle: 'Track from next' },
      correctChoiceId: 'b',
    };

    const result = enrichReveal(previous, fromNext, baseQuestion.reveal);
    expect(result).toBeDefined();
    const validated = RevealSchema.parse(result!);
    expect(validated.correctChoiceId).toBe('b');
    expect(validated.links).toEqual([
      { provider: 'spotify', url: 'https://open.spotify.com/track/test' },
    ]);
    expect(validated.meta).toMatchObject({
      trackTitle: 'Track from next',
    });
  });

  it('produces question records with choice labels and reveal metadata', () => {
    const reveal: Reveal = {
      correctChoiceId: 'a',
      meta: { workTitle: 'Work' },
    };
    const record = toQuestionRecord({
      question: baseQuestion,
      reveal,
      outcome: 'correct' as Outcome,
      remainingMs: 8000,
      choiceId: 'a',
      points: 140,
    });

    expect(record).toMatchObject({
      questionId: 'q-1',
      choiceId: 'a',
      choiceLabel: 'Option A',
      correctChoiceId: 'a',
      correctLabel: 'Option A',
      outcome: 'correct',
      remainingMs: 8000,
      points: 140,
    });
  });

  it('persists enriched reveals so links and meta survive result storage', () => {
    const fromNext: Reveal = {
      links: [
        { provider: 'youtube', url: 'https://youtube.com/watch?v=123', label: 'YouTube' },
        { provider: 'spotify', url: 'https://open.spotify.com/track/foo' },
      ],
      meta: { workTitle: 'Battle Theme', composer: 'N. Uematsu' },
      correctChoiceId: 'b',
    };

    const enriched = enrichReveal(undefined, fromNext, baseQuestion.reveal);
    expect(enriched).toBeDefined();
    appendReveal(enriched);

    const [firstStored] = loadReveals<Reveal>();
    const lastStored = loadLastReveal<Reveal>();
    expect(firstStored).toBeDefined();
    expect(lastStored).toBeDefined();

    const validatedHistory = RevealSchema.parse(firstStored!);
    const validatedLast = RevealSchema.parse(lastStored!);

    expect(validatedHistory.links?.[0]).toMatchObject({ provider: 'youtube', label: 'YouTube' });
    expect(validatedLast.links?.[1]).toMatchObject({ provider: 'spotify' });
    expect(validatedLast.meta).toMatchObject({ workTitle: 'Battle Theme', composer: 'N. Uematsu' });
  });

  it('flags unsupported providers in reveal payload', () => {
    expect(() =>
      RevealSchema.parse({
        links: [{ provider: 'invalid', url: 'https://example.com' }],
      }),
    ).toThrow();
  });
});

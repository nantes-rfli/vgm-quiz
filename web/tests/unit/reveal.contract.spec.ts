import { describe, expect, it } from 'vitest';

import type { Question, Reveal } from '@/src/features/quiz/api/types';
import { enrichReveal, toQuestionRecord } from '@/src/features/quiz/lib/reveal';
import type { Outcome } from '@/src/lib/resultStorage';

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
    expect(result?.correctChoiceId).toBe('b');
    expect(result?.links).toEqual([
      { provider: 'spotify', url: 'https://open.spotify.com/track/test' },
    ]);
    expect(result?.meta).toMatchObject({
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
});

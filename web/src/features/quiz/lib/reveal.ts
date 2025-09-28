import type { Question, Reveal } from '../api/types';
import type { Outcome, QuestionRecord } from '@/src/lib/resultStorage';

export function enrichReveal(
  prev: Reveal | undefined,
  fromNext?: Reveal,
  fromQuestion?: Reveal
): Reveal | undefined {
  const fallback = prev ?? fromQuestion;
  if (!fromNext) return fallback;
  if (!fallback) return fromNext;

  return {
    ...fallback,
    ...fromNext,
    links: fromNext.links && fromNext.links.length > 0 ? fromNext.links : fallback.links,
    meta: fromNext.meta ?? fallback.meta,
  };
}

export function toQuestionRecord(params: {
  question: Question;
  reveal?: Reveal;
  outcome: Outcome;
  remainingMs: number;
  choiceId?: string;
  points: number;
}): QuestionRecord {
  const { question, reveal, outcome, remainingMs, choiceId, points } = params;
  const choiceLabel = choiceId ? question.choices.find((c) => c.id === choiceId)?.label : undefined;
  const correctChoiceId = reveal?.correctChoiceId;
  const correctLabel = correctChoiceId ? question.choices.find((c) => c.id === correctChoiceId)?.label : undefined;
  return {
    questionId: question.id,
    prompt: question.prompt,
    choiceId,
    choiceLabel,
    correctChoiceId,
    correctLabel,
    outcome,
    remainingMs,
    points,
  };
}

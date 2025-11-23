import { msToSeconds } from './timeUtils';
import type { ScoreBreakdown, QuestionRecord, ResultSummary, Outcome } from './resultStorage';

/**
 * Computes points earned for a correct answer based on remaining time.
 * Base points: 100
 * Time bonus: 5 points per remaining second
 *
 * @param remainingMs - Milliseconds remaining when answer was submitted
 * @returns Total points earned
 */
export function computePoints(remainingMs: number): number {
  return 100 + msToSeconds(remainingMs) * 5;
}

/**
 * Updates the running score tally with a new question result.
 *
 * @param prev - Previous score breakdown
 * @param outcome - Result of the question (correct, wrong, timeout, skip)
 * @param pointsDelta - Points to add (typically 0 for incorrect answers)
 * @returns Updated score breakdown
 */
export function rollupTally(prev: ScoreBreakdown, outcome: Outcome, pointsDelta: number): ScoreBreakdown {
  return {
    correct: prev.correct + (outcome === 'correct' ? 1 : 0),
    wrong: prev.wrong + (outcome === 'wrong' ? 1 : 0),
    timeout: prev.timeout + (outcome === 'timeout' ? 1 : 0),
    skip: prev.skip + (outcome === 'skip' ? 1 : 0),
    points: prev.points + pointsDelta,
  };
}

/**
 * Composes a final result summary from score tally and question history.
 *
 * @param input - Score data, question history, and timing information
 * @returns Complete result summary ready for storage
 */
export function composeSummary(input: {
  tally: ScoreBreakdown;
  history: QuestionRecord[];
  total: number;
  startedAt?: string;
  finishedAt: string;
  mode?: string;
  arm?: string;
}): ResultSummary {
  return {
    answeredCount: input.history.length,
    total: input.total,
    score: input.tally,
    questions: input.history,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    mode: input.mode,
    arm: input.arm,
  };
}

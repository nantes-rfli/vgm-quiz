// Auto-generated: cleaned fixtures
import startRound from '../rounds.start.ok.json';
import composerStartRound from '../rounds.composer.start.json';
import next01 from './next.01.json';
import next02 from './next.02.json';
import next03 from './next.03.json';
import next04 from './next.04.json';
import next05 from './next.05.json';
import next06 from './next.06.json';
import next07 from './next.07.json';
import next08 from './next.08.json';
import next09 from './next.09.json';
// Phase 2B: Filter-specific fixtures
import difficultyEasyFixture from './difficulty-easy.json';
import difficultyHardFixture from './difficulty-hard.json';
import era90sFixture from './era-90s.json';
import type { Question } from '@/src/features/quiz/api/types';
import type { Difficulty, Era } from '@/src/features/quiz/api/manifest';

export const TOTAL = 10;

export function getQuestionByIndex(index: number): Question | undefined {
  // Type assertion needed because JSON fixtures have string for provider,
  // but Question type expects literal union "youtube" | "appleMusic" | "spotify" | "other"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cases: Record<number, any> = {
    1: startRound.question, // First question from rounds.start.ok.json
    2: next01.question,
    3: next02.question,
    4: next03.question,
    5: next04.question,
    6: next05.question,
    7: next06.question,
    8: next07.question,
    9: next08.question,
    10: next09.question,
  };
  return cases[index] as Question | undefined;
}

/**
 * Get the first question based on applied filters
 * Phase 2B: Returns filter-specific fixture if available, falls back to default
 * @param difficulty - Filter by difficulty level (easy/normal/hard)
 * @param era - Filter by era (80s/90s/00s/10s/20s)
 * @param series - Filter by game series (planned for future implementation)
 */
export function getFirstQuestionByFilters(
  difficulty?: Difficulty,
  era?: Era,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  series?: string[],
): Question | undefined {
  // Simple routing: check difficulty first, then era
  // Series filtering is planned for future implementation
  if (difficulty === 'easy') {
    // Type assertion needed because JSON fixtures have different types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return difficultyEasyFixture.question as any as Question;
  }

  if (difficulty === 'hard') {
    // Type assertion needed because JSON fixtures have different types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return difficultyHardFixture.question as any as Question;
  }

  if (era === '90s') {
    // Type assertion needed because JSON fixtures have different types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return era90sFixture.question as any as Question;
  }

  // Default: return first question from default fixture
  return getQuestionByIndex(1);
}

export function getFirstQuestionByMode(
  modeId: string | undefined,
  difficulty?: Difficulty,
  era?: Era,
  series?: string[],
): Question | undefined {
  if (modeId === 'vgm_composer-ja') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return composerStartRound.question as any as Question;
  }
  return getFirstQuestionByFilters(difficulty, era, series);
}

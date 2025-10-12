// Auto-generated: cleaned fixtures
import startRound from '../rounds.start.ok.json';
import next01 from './next.01.json';
import next02 from './next.02.json';
import next03 from './next.03.json';
import next04 from './next.04.json';
import next05 from './next.05.json';
import next06 from './next.06.json';
import next07 from './next.07.json';
import next08 from './next.08.json';
import next09 from './next.09.json';
import type { Question } from '@/src/features/quiz/api/types';

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

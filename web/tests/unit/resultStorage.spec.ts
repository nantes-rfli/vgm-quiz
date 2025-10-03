import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveResult,
  loadResult,
  appendReveal,
  loadReveals,
  loadLastReveal,
  clearReveals,
  RESULT_KEY,
  REVEAL_KEY,
  REVEALS_KEY,
  type ResultSummary,
  type ScoreBreakdown,
} from '@/src/lib/resultStorage';

describe('resultStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('saveResult and loadResult', () => {
    it('saves and loads a complete result summary', () => {
      const summary: ResultSummary = {
        answeredCount: 5,
        total: 10,
        score: { correct: 3, wrong: 1, timeout: 1, skip: 0, points: 350 },
        questions: [
          {
            questionId: 'q1',
            prompt: 'What is this?',
            choiceId: 'c1',
            choiceLabel: 'Choice 1',
            correctChoiceId: 'c1',
            correctLabel: 'Choice 1',
            outcome: 'correct',
            remainingMs: 5000,
            points: 100,
          },
        ],
        startedAt: '2025-09-28T10:00:00Z',
        finishedAt: '2025-09-28T10:05:00Z',
      };

      saveResult(summary);
      const loaded = loadResult();

      expect(loaded).toEqual({
        ...summary,
        durationMs: 5 * 60 * 1000, // 5 minutes
      });
    });

    it('derives durationMs from startedAt and finishedAt if not present', () => {
      const summary: ResultSummary = {
        answeredCount: 1,
        total: 1,
        score: { correct: 1, wrong: 0, timeout: 0, skip: 0, points: 100 },
        questions: [],
        startedAt: '2025-09-28T10:00:00Z',
        finishedAt: '2025-09-28T10:02:30Z',
      };

      saveResult(summary);
      const loaded = loadResult();

      expect(loaded?.durationMs).toBe(150000); // 2.5 minutes in ms
    });

    it('does not override existing durationMs', () => {
      const summary: ResultSummary = {
        answeredCount: 1,
        total: 1,
        score: { correct: 1, wrong: 0, timeout: 0, skip: 0, points: 100 },
        questions: [],
        startedAt: '2025-09-28T10:00:00Z',
        finishedAt: '2025-09-28T10:02:00Z',
        durationMs: 999999, // Manual override
      };

      saveResult(summary);
      const loaded = loadResult();

      expect(loaded?.durationMs).toBe(999999);
    });

    it('returns undefined when no result is stored', () => {
      expect(loadResult()).toBeUndefined();
    });

    it('normalizes partial data with default values', () => {
      const partial = {
        answeredCount: 3,
        // Missing total, score, questions
      };

      sessionStorage.setItem(RESULT_KEY, JSON.stringify(partial));
      const loaded = loadResult();

      expect(loaded).toEqual({
        answeredCount: 3,
        total: 0,
        score: { correct: 0, wrong: 0, timeout: 0, skip: 0, points: 0 },
        questions: [],
        startedAt: undefined,
        finishedAt: undefined,
        durationMs: undefined,
      });
    });

    it('handles corrupted JSON gracefully', () => {
      sessionStorage.setItem(RESULT_KEY, 'not valid json {{{');
      expect(loadResult()).toBeUndefined();
    });

    it('falls back to legacy keys if primary key is not found', () => {
      const summary: ResultSummary = {
        answeredCount: 2,
        total: 5,
        score: { correct: 2, wrong: 0, timeout: 0, skip: 0, points: 200 },
        questions: [],
      };

      // Save to legacy key
      sessionStorage.setItem('vgm2.result', JSON.stringify(summary));
      const loaded = loadResult();

      expect(loaded?.answeredCount).toBe(2);
      expect(loaded?.total).toBe(5);
    });

    it('prefers primary key over fallback keys', () => {
      const primary: ResultSummary = {
        answeredCount: 10,
        total: 10,
        score: { correct: 10, wrong: 0, timeout: 0, skip: 0, points: 1000 },
        questions: [],
      };

      const legacy: ResultSummary = {
        answeredCount: 5,
        total: 10,
        score: { correct: 5, wrong: 0, timeout: 0, skip: 0, points: 500 },
        questions: [],
      };

      sessionStorage.setItem(RESULT_KEY, JSON.stringify(primary));
      sessionStorage.setItem('vgm2.result', JSON.stringify(legacy));

      const loaded = loadResult();
      expect(loaded?.answeredCount).toBe(10); // Primary key wins
    });
  });

  describe('reveal management', () => {
    interface TestReveal {
      id: string;
      data: string;
    }

    it('appends and loads reveals', () => {
      const reveal1: TestReveal = { id: 'r1', data: 'first' };
      const reveal2: TestReveal = { id: 'r2', data: 'second' };

      appendReveal(reveal1);
      appendReveal(reveal2);

      const reveals = loadReveals<TestReveal>();
      expect(reveals).toEqual([reveal1, reveal2]);
    });

    it('tracks last reveal separately', () => {
      const reveal1: TestReveal = { id: 'r1', data: 'first' };
      const reveal2: TestReveal = { id: 'r2', data: 'second' };

      appendReveal(reveal1);
      appendReveal(reveal2);

      const last = loadLastReveal<TestReveal>();
      expect(last).toEqual(reveal2);
    });

    it('returns empty array when no reveals are stored', () => {
      expect(loadReveals()).toEqual([]);
    });

    it('returns undefined when no last reveal is stored', () => {
      expect(loadLastReveal()).toBeUndefined();
    });

    it('clears all reveals', () => {
      const reveal: TestReveal = { id: 'r1', data: 'test' };
      appendReveal(reveal);

      clearReveals();

      expect(loadReveals()).toEqual([]);
      expect(loadLastReveal()).toBeUndefined();
    });

    it('handles corrupted reveals array gracefully', () => {
      sessionStorage.setItem(REVEALS_KEY, 'not an array');
      expect(loadReveals()).toEqual([]);
    });

    it('handles corrupted last reveal gracefully', () => {
      sessionStorage.setItem(REVEAL_KEY, 'invalid json');
      expect(loadLastReveal()).toBeUndefined();
    });

    it('does not append undefined reveals', () => {
      appendReveal(undefined);
      expect(loadReveals()).toEqual([]);
    });

    it('initializes reveals array if not present', () => {
      const reveal: TestReveal = { id: 'r1', data: 'first' };
      appendReveal(reveal);

      const reveals = loadReveals<TestReveal>();
      expect(reveals).toEqual([reveal]);
    });

    it('preserves existing reveals when appending', () => {
      const reveal1: TestReveal = { id: 'r1', data: 'first' };
      const reveal2: TestReveal = { id: 'r2', data: 'second' };

      appendReveal(reveal1);
      appendReveal(reveal2);

      const reveals = loadReveals<TestReveal>();
      expect(reveals.length).toBe(2);
      expect(reveals[0]).toEqual(reveal1);
      expect(reveals[1]).toEqual(reveal2);
    });

    it('handles corrupted existing reveals when appending', () => {
      sessionStorage.setItem(REVEALS_KEY, 'corrupted data');
      const reveal: TestReveal = { id: 'r1', data: 'new' };

      appendReveal(reveal);

      const reveals = loadReveals<TestReveal>();
      expect(reveals).toEqual([reveal]); // Starts fresh with new reveal
    });
  });

  describe('edge cases and error handling', () => {
    it('handles invalid date strings in durationMs calculation', () => {
      const summary: ResultSummary = {
        answeredCount: 1,
        total: 1,
        score: { correct: 1, wrong: 0, timeout: 0, skip: 0, points: 100 },
        questions: [],
        startedAt: 'invalid-date',
        finishedAt: '2025-09-28T10:00:00Z',
      };

      saveResult(summary);
      const loaded = loadResult();

      expect(loaded?.durationMs).toBeUndefined();
    });

    it('handles finishedAt before startedAt', () => {
      const summary: ResultSummary = {
        answeredCount: 1,
        total: 1,
        score: { correct: 1, wrong: 0, timeout: 0, skip: 0, points: 100 },
        questions: [],
        startedAt: '2025-09-28T10:05:00Z',
        finishedAt: '2025-09-28T10:00:00Z', // Earlier than start
      };

      saveResult(summary);
      const loaded = loadResult();

      expect(loaded?.durationMs).toBeUndefined();
    });

    it('handles non-array questions field', () => {
      const invalid = {
        answeredCount: 1,
        total: 1,
        score: { correct: 1, wrong: 0, timeout: 0, skip: 0, points: 100 },
        questions: 'not an array',
      };

      sessionStorage.setItem(RESULT_KEY, JSON.stringify(invalid));
      const loaded = loadResult();

      expect(loaded?.questions).toEqual([]);
    });
  });
});
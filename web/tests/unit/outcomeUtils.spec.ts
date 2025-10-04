import { describe, it, expect } from 'vitest';
import { getOutcomeDisplay } from '@/src/lib/outcomeUtils';
import type { Outcome } from '@/src/lib/resultStorage';

describe('getOutcomeDisplay', () => {
  it('returns correct display for "correct" outcome', () => {
    const result = getOutcomeDisplay('correct');
    expect(result).toEqual({
      key: 'outcome.correct',
      className: 'text-emerald-700',
    });
  });

  it('returns correct display for "wrong" outcome', () => {
    const result = getOutcomeDisplay('wrong');
    expect(result).toEqual({
      key: 'outcome.wrong',
      className: 'text-rose-700',
    });
  });

  it('returns correct display for "timeout" outcome', () => {
    const result = getOutcomeDisplay('timeout');
    expect(result).toEqual({
      key: 'outcome.timeout',
      className: 'text-orange-600',
    });
  });

  it('returns correct display for "skip" outcome', () => {
    const result = getOutcomeDisplay('skip');
    expect(result).toEqual({
      key: 'outcome.skip',
      className: 'text-slate-600',
    });
  });

  it('handles unknown outcome types gracefully', () => {
    // TypeScript will prevent this at compile time, but test runtime behavior
    const unknownOutcome = 'unknown' as Outcome;
    const result = getOutcomeDisplay(unknownOutcome);
    expect(result).toEqual({
      key: 'unknown',
      className: 'text-gray-500',
    });
  });

  describe('consistency across outcomes', () => {
    it('always returns an object with key and className', () => {
      const outcomes: Outcome[] = ['correct', 'wrong', 'timeout', 'skip'];
      outcomes.forEach((outcome) => {
        const result = getOutcomeDisplay(outcome);
        expect(result).toHaveProperty('key');
        expect(result).toHaveProperty('className');
        expect(typeof result.key).toBe('string');
        expect(typeof result.className).toBe('string');
        expect(result.key.length).toBeGreaterThan(0);
        expect(result.className.length).toBeGreaterThan(0);
      });
    });

    it('uses Tailwind CSS color classes', () => {
      const outcomes: Outcome[] = ['correct', 'wrong', 'timeout', 'skip'];
      outcomes.forEach((outcome) => {
        const result = getOutcomeDisplay(outcome);
        expect(result.className).toMatch(/^text-\w+-\d{3}$/);
      });
    });
  });
});
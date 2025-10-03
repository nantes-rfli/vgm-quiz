import { describe, it, expect } from 'vitest';
import { getOutcomeDisplay } from '@/src/lib/outcomeUtils';
import type { Outcome } from '@/src/lib/resultStorage';

describe('getOutcomeDisplay', () => {
  it('returns correct display for "correct" outcome', () => {
    const result = getOutcomeDisplay('correct');
    expect(result).toEqual({
      label: 'Correct',
      className: 'text-emerald-700',
    });
  });

  it('returns correct display for "wrong" outcome', () => {
    const result = getOutcomeDisplay('wrong');
    expect(result).toEqual({
      label: 'Wrong',
      className: 'text-rose-700',
    });
  });

  it('returns correct display for "timeout" outcome', () => {
    const result = getOutcomeDisplay('timeout');
    expect(result).toEqual({
      label: 'Timeout',
      className: 'text-orange-600',
    });
  });

  it('returns correct display for "skip" outcome', () => {
    const result = getOutcomeDisplay('skip');
    expect(result).toEqual({
      label: 'Skipped',
      className: 'text-slate-600',
    });
  });

  it('handles unknown outcome types gracefully', () => {
    // TypeScript will prevent this at compile time, but test runtime behavior
    const unknownOutcome = 'unknown' as Outcome;
    const result = getOutcomeDisplay(unknownOutcome);
    expect(result).toEqual({
      label: 'unknown',
      className: 'text-gray-500',
    });
  });

  describe('consistency across outcomes', () => {
    it('always returns an object with label and className', () => {
      const outcomes: Outcome[] = ['correct', 'wrong', 'timeout', 'skip'];
      outcomes.forEach((outcome) => {
        const result = getOutcomeDisplay(outcome);
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('className');
        expect(typeof result.label).toBe('string');
        expect(typeof result.className).toBe('string');
        expect(result.label.length).toBeGreaterThan(0);
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
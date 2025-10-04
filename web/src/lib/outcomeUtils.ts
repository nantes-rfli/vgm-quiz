import type { Outcome } from './resultStorage';

/**
 * Returns display information for a quiz outcome.
 *
 * @param outcome - The outcome type (correct, wrong, timeout, skip)
 * @returns An object containing the translation key and CSS className for styling
 */
export function getOutcomeDisplay(outcome: Outcome): {
  key: string;
  className: string;
} {
  switch (outcome) {
    case 'correct':
      return { key: 'outcome.correct', className: 'text-emerald-700' };
    case 'wrong':
      return { key: 'outcome.wrong', className: 'text-rose-700' };
    case 'timeout':
      return { key: 'outcome.timeout', className: 'text-orange-600' };
    case 'skip':
      return { key: 'outcome.skip', className: 'text-slate-600' };
    default:
      return { key: outcome, className: 'text-gray-500' };
  }
}
import type { Outcome } from './resultStorage';

/**
 * Returns display information for a quiz outcome.
 *
 * @param outcome - The outcome type (correct, wrong, timeout, skip)
 * @returns An object containing the label text and CSS className for styling
 */
export function getOutcomeDisplay(outcome: Outcome): {
  label: string;
  className: string;
} {
  switch (outcome) {
    case 'correct':
      return { label: 'Correct', className: 'text-emerald-700' };
    case 'wrong':
      return { label: 'Wrong', className: 'text-rose-700' };
    case 'timeout':
      return { label: 'Timeout', className: 'text-orange-600' };
    case 'skip':
      return { label: 'Skipped', className: 'text-slate-600' };
    default:
      return { label: outcome, className: 'text-gray-500' };
  }
}
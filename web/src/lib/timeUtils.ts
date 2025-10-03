/**
 * Converts milliseconds to seconds with configurable rounding behavior.
 *
 * @param ms - The time in milliseconds to convert
 * @param roundUp - If true, rounds up using Math.ceil; otherwise rounds down using Math.floor
 * @returns The converted time in seconds, guaranteed to be non-negative
 */
export function msToSeconds(ms: number, roundUp = false): number {
  return Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
}
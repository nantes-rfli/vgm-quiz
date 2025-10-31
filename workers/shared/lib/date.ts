/**
 * Get today's date in JST timezone (YYYY-MM-DD)
 * Uses arithmetic on UTC timestamp to avoid locale-dependent parsing
 */
export function getTodayJST(): string {
  const nowMs = Date.now()
  const jstOffsetMs = 9 * 60 * 60 * 1000 // JST is UTC+9
  const jstDate = new Date(nowMs + jstOffsetMs)
  return jstDate.toISOString().split('T')[0]
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

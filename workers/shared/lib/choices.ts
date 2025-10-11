import type { Choice } from '../types/export'

/**
 * Generate 4 choices: 1 correct + 3 wrong
 * Wrong choices are selected from other tracks' game titles
 * @throws Error if there are not enough unique games (minimum 4 required)
 */
export function generateChoices(
  correctGame: string,
  allGames: string[],
  questionId: string,
): Choice[] {
  // Filter out the correct answer and duplicates
  const uniqueGames = Array.from(new Set(allGames))
  const wrongGames = uniqueGames.filter((g) => g !== correctGame)

  // Validate: need at least 3 wrong answers
  if (wrongGames.length < 3) {
    throw new Error(
      `Not enough unique games to generate choices. Need at least 4 unique games, got ${uniqueGames.length}`,
    )
  }

  // Shuffle and pick 3 wrong answers
  const shuffled = shuffleArray(wrongGames, questionId)
  const selectedWrong = shuffled.slice(0, 3)

  // Create choices
  const choices: Choice[] = [
    { id: 'a', text: correctGame, correct: true },
    { id: 'b', text: selectedWrong[0], correct: false },
    { id: 'c', text: selectedWrong[1], correct: false },
    { id: 'd', text: selectedWrong[2], correct: false },
  ]

  // Shuffle choices (deterministic based on questionId)
  return shuffleArray(choices, questionId)
}

/**
 * Deterministic shuffle based on seed
 */
function shuffleArray<T>(array: T[], seed: string): T[] {
  const arr = [...array]
  const hash = simpleHash(seed)

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(hash + i) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Seeded random number generator (0-1)
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

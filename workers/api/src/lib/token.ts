/**
 * API Worker token utilities
 * Uses shared library from workers/shared/lib/token.ts
 * Supports both Phase 1 (Base64) and Phase 2B (JWS) tokens
 */

import {
  type Phase2TokenPayload,
  createJWSToken,
  isJWSToken,
  verifyJWSToken,
} from '../../../shared/lib/token'

/**
 * Phase 1 Token Payload (Base64 encoded, no signature)
 * Kept for backward compatibility
 */
export interface Phase1TokenPayload {
  date: string
  currentIndex: number
  totalQuestions: number
}

/**
 * Re-export Phase2TokenPayload from shared library
 */
export type { Phase2TokenPayload } from '../../../shared/lib/token'

/**
 * Union type for both Phase 1 and Phase 2 tokens
 */
export type TokenPayload = Phase1TokenPayload | Phase2TokenPayload

/**
 * Type guard: check if token is Phase 1 format
 */
export function isPhase1Token(token: TokenPayload): token is Phase1TokenPayload {
  return 'date' in token && 'currentIndex' in token && 'totalQuestions' in token
}

/**
 * Type guard: check if token is Phase 2 format
 */
export function isPhase2Token(token: TokenPayload): token is Phase2TokenPayload {
  return 'rid' in token && 'idx' in token && 'seed' in token && 'filtersHash' in token
}

/**
 * Create continuation token (Phase 1 - simple base64 encoding)
 * Kept for backward compatibility during Phase 2 transition
 */
export async function createContinuationToken(payload: Phase1TokenPayload): Promise<string> {
  const json = JSON.stringify(payload)
  const encoder = new TextEncoder()
  const data = encoder.encode(json)
  const base64 = btoa(String.fromCharCode(...data))
  return base64
}

/**
 * Decode continuation token (Phase 1 or Phase 2)
 * Automatically detects token version and validates accordingly
 */
export async function decodeContinuationToken(
  token: string,
  secret?: string,
): Promise<TokenPayload | null> {
  // Check if JWS token (Phase 2B)
  if (isJWSToken(token)) {
    if (!secret) {
      console.error('JWS token requires secret for verification')
      return null
    }
    return verifyJWSToken(token, secret)
  }

  // Fall back to Phase 1 Base64 decoding
  try {
    const decoded = atob(token)
    const bytes = new Uint8Array(decoded.split('').map((c) => c.charCodeAt(0)))
    const decoder = new TextDecoder()
    const json = decoder.decode(bytes)
    return JSON.parse(json) as Phase1TokenPayload
  } catch (error) {
    console.error('Failed to decode token:', error)
    return null
  }
}

/**
 * Export shared functions for use in API routes
 */
export { createJWSToken, verifyJWSToken }

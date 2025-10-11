interface TokenPayload {
  date: string
  currentIndex: number
  totalQuestions: number
}

/**
 * Create continuation token (simple base64 encoding for Phase 1)
 * Phase 2: Use JWS for signature verification
 */
export async function createContinuationToken(payload: TokenPayload): Promise<string> {
  const json = JSON.stringify(payload)
  const encoder = new TextEncoder()
  const data = encoder.encode(json)
  const base64 = btoa(String.fromCharCode(...data))
  return base64
}

/**
 * Decode continuation token
 */
export async function decodeContinuationToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = atob(token)
    const bytes = new Uint8Array(decoded.split('').map((c) => c.charCodeAt(0)))
    const decoder = new TextDecoder()
    const json = decoder.decode(bytes)
    return JSON.parse(json) as TokenPayload
  } catch (error) {
    console.error('Failed to decode token:', error)
    return null
  }
}

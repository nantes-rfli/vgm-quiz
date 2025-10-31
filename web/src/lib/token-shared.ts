/**
 * Shared JWS token utilities for frontend
 * Based on workers/shared/lib/token.ts
 * Uses Web Crypto API for token signing/verification
 */

/**
 * Phase 2B Token Payload (JWS signed)
 */
export interface Phase2TokenPayload {
  rid: string // Round ID (UUID)
  idx: number // Current question index (0-based)
  total: number // Total questions
  seed: string // Sampling seed (base64url)
  filtersHash: string // SHA-256 hash of canonicalized filters (base64url)
  ver: number // Token spec version (1)
  iat: number // Issued at (Unix timestamp)
  exp: number // Expiration (Unix timestamp)
  aud?: string // Audience (optional, e.g., "rounds")
  nbf?: number // Not before (optional)
}

/**
 * Base64url encode (RFC 4648, no padding)
 */
export function encodeBase64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Base64url decode (RFC 4648, no padding)
 */
export function decodeBase64url(encoded: string): Uint8Array {
  const base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Create JWS token (Phase 2B)
 * Uses HMAC-SHA256 for signing
 */
export async function createJWSToken(
  payload: Omit<Phase2TokenPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds: number = 120,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload: Phase2TokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  }

  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  // Encode header and payload
  const headerEncoded = encodeBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadEncoded = encodeBase64url(new TextEncoder().encode(JSON.stringify(jwtPayload)))

  // Create signature
  const messageToSign = `${headerEncoded}.${payloadEncoded}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(messageToSign))

  // Return JWS compact serialization
  return `${messageToSign}.${encodeBase64url(signature)}`
}

/**
 * Verify and decode JWS token (Phase 2B)
 */
export async function verifyJWSToken(
  token: string,
  secret: string,
): Promise<Phase2TokenPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('Invalid JWS format: expected 3 parts')
      return null
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts

    // Verify signature
    const messageToSign = `${headerEncoded}.${payloadEncoded}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'verify',
    ])

    const signatureBuffer = decodeBase64url(signatureEncoded)
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer as unknown as ArrayBuffer,
      encoder.encode(messageToSign),
    )

    if (!isValid) {
      console.error('JWS signature verification failed')
      return null
    }

    // Decode payload
    const payloadBuffer = decodeBase64url(payloadEncoded)
    const payloadDecoder = new TextDecoder()
    const payloadJson = payloadDecoder.decode(payloadBuffer)
    const payload = JSON.parse(payloadJson) as Phase2TokenPayload

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      console.error('JWS token expired')
      return null
    }

    return payload
  } catch (error) {
    console.error('Failed to verify JWS token:', error)
    return null
  }
}

/**
 * Helper to detect JWS token format
 * JWS has 3 dot-separated parts (header.payload.signature)
 * Base64 has no dots
 */
export function isJWSToken(token: string): boolean {
  return token.includes('.')
}

import { beforeEach, describe, expect, it } from 'vitest'
import {
  type Phase2TokenPayload,
  createJWSToken,
  decodeBase64url,
  encodeBase64url,
  verifyJWSToken,
} from '../shared/lib/token'

const TEST_SECRET = 'test-secret-key-32-chars-minimum-'
const TEST_TTL = 3600 // 1 hour

describe('Token signing and verification', () => {
  let validPayload: Omit<Phase2TokenPayload, 'iat' | 'exp'>

  beforeEach(() => {
    validPayload = {
      rid: 'test-round-id-uuid',
      idx: 0,
      total: 10,
      seed: 'test-seed-16-char',
      filtersHash: '00000f62',
      filtersKey: '{}',
      mode: 'vgm_v1-ja',
      date: '2025-11-03',
      ver: 1,
      aud: 'rounds',
    }
  })

  describe('createJWSToken', () => {
    it('creates a valid JWS token with 3 parts', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      const parts = token.split('.')
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBeDefined() // header
      expect(parts[1]).toBeDefined() // payload
      expect(parts[2]).toBeDefined() // signature
    })

    it('generates different tokens for different payloads', async () => {
      const token1 = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)

      const payload2 = { ...validPayload, idx: 1 }
      const token2 = await createJWSToken(payload2, TEST_SECRET, TEST_TTL)

      expect(token1).not.toBe(token2)
    })

    it('includes iat and exp in token payload', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const verified = await verifyJWSToken(token, TEST_SECRET)

      expect(verified).toBeDefined()
      expect(verified?.iat).toBeDefined()
      expect(verified?.exp).toBeDefined()
      expect(typeof verified?.iat).toBe('number')
      expect(typeof verified?.exp).toBe('number')
    })

    it('sets correct token expiration', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const verified = await verifyJWSToken(token, TEST_SECRET)

      expect(verified).toBeDefined()
      expect(verified?.exp).toBeGreaterThanOrEqual(nowSeconds + TEST_TTL - 1) // -1 for rounding
      expect(verified?.exp).toBeLessThanOrEqual(nowSeconds + TEST_TTL + 1) // +1 for rounding
    })

    it('preserves optional fields', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const verified = await verifyJWSToken(token, TEST_SECRET)

      expect(verified).toBeDefined()
      expect(verified?.aud).toBe('rounds')
    })
  })

  describe('verifyJWSToken', () => {
    it('verifies a valid token', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const verified = await verifyJWSToken(token, TEST_SECRET)

      expect(verified).toBeDefined()
      expect(verified?.rid).toBe(validPayload.rid)
      expect(verified?.idx).toBe(validPayload.idx)
      expect(verified?.total).toBe(validPayload.total)
      expect(verified?.seed).toBe(validPayload.seed)
      expect(verified?.filtersHash).toBe(validPayload.filtersHash)
    })

    it('rejects token with invalid signature', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const parts = token.split('.')

      // Tamper with the payload
      const tamperedPayload = encodeBase64url(
        new TextEncoder().encode(JSON.stringify({ ...validPayload, idx: 999 })),
      )
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      const verified = await verifyJWSToken(tamperedToken, TEST_SECRET)
      expect(verified).toBeNull()
    })

    it('rejects token with modified signature', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const parts = token.split('.')

      // Modify the signature
      const signature = decodeBase64url(parts[2])
      const modifiedSignature = new Uint8Array(signature)
      modifiedSignature[0] = (modifiedSignature[0] + 1) % 256
      const tamperedSignature = encodeBase64url(modifiedSignature)

      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`

      const verified = await verifyJWSToken(tamperedToken, TEST_SECRET)
      expect(verified).toBeNull()
    })

    it('rejects token with wrong secret', async () => {
      const token = await createJWSToken(validPayload, TEST_SECRET, TEST_TTL)
      const wrongSecret = 'wrong-secret-key-32-chars-minimum'

      const verified = await verifyJWSToken(token, wrongSecret)
      expect(verified).toBeNull()
    })

    it('rejects expired token', async () => {
      // Create token with negative TTL (already expired)
      // Note: We can't test actual expiration easily in sync code,
      // so we create a token manually with past expiration timestamp
      const now = Math.floor(Date.now() / 1000)
      const expiredPayload: Phase2TokenPayload = {
        rid: validPayload.rid,
        idx: validPayload.idx,
        total: validPayload.total,
        seed: validPayload.seed,
        filtersHash: validPayload.filtersHash,
        filtersKey: validPayload.filtersKey,
        ver: validPayload.ver,
        iat: now - 100, // Issued 100 seconds ago
        exp: now - 10, // Expired 10 seconds ago
      }

      // Manually construct an expired token
      const header = { alg: 'HS256', typ: 'JWT' }
      const headerEncoded = encodeBase64url(new TextEncoder().encode(JSON.stringify(header)))
      const payloadEncoded = encodeBase64url(
        new TextEncoder().encode(JSON.stringify(expiredPayload)),
      )

      const messageToSign = `${headerEncoded}.${payloadEncoded}`
      const encoder = new TextEncoder()
      const keyData = encoder.encode(TEST_SECRET)
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(messageToSign))
      const expiredToken = `${messageToSign}.${encodeBase64url(signature)}`

      const verified = await verifyJWSToken(expiredToken, TEST_SECRET)
      expect(verified).toBeNull()
    })

    it('rejects malformed token (wrong part count)', async () => {
      const malformedToken = 'header.payload' // Missing signature

      const verified = await verifyJWSToken(malformedToken, TEST_SECRET)
      expect(verified).toBeNull()
    })

    it('rejects token with invalid base64url encoding', async () => {
      const malformedToken = 'header!!!.payload!!!.signature!!!'

      const verified = await verifyJWSToken(malformedToken, TEST_SECRET)
      expect(verified).toBeNull()
    })
  })

  describe('Base64url encoding', () => {
    it('encodes ArrayBuffer to base64url string', () => {
      const data = new TextEncoder().encode('test data')
      const encoded = encodeBase64url(data)

      expect(typeof encoded).toBe('string')
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')
    })

    it('encodes and decodes correctly (round-trip)', () => {
      const original = 'test string with special chars: !@#$%^&*()'
      const data = new TextEncoder().encode(original)

      const encoded = encodeBase64url(data)
      const decoded = decodeBase64url(encoded)
      const decodedString = new TextDecoder().decode(decoded)

      expect(decodedString).toBe(original)
    })

    it('handles empty data', () => {
      const data = new Uint8Array(0)
      const encoded = encodeBase64url(data)
      const decoded = decodeBase64url(encoded)

      expect(decoded.length).toBe(0)
    })

    it('handles large data', () => {
      const largeData = new Uint8Array(10000)
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256
      }

      const encoded = encodeBase64url(largeData)
      const decoded = decodeBase64url(encoded)

      expect(decoded).toEqual(largeData)
    })
  })

  describe('Token lifecycle', () => {
    it('supports sequential token regeneration with idx increment', async () => {
      const payload1 = { ...validPayload, idx: 0 }
      const token1 = await createJWSToken(payload1, TEST_SECRET, TEST_TTL)
      const verified1 = await verifyJWSToken(token1, TEST_SECRET)

      expect(verified1).toBeDefined()
      if (!verified1) throw new Error('expected verified token')
      expect(verified1.idx).toBe(0)

      // Regenerate with next idx
      const payload2 = {
        rid: verified1.rid,
        idx: verified1.idx + 1,
        total: verified1.total,
        seed: verified1.seed,
        filtersHash: verified1.filtersHash,
        filtersKey: verified1.filtersKey,
        ver: verified1.ver,
      }
      const token2 = await createJWSToken(payload2, TEST_SECRET, TEST_TTL)
      const verified2 = await verifyJWSToken(token2, TEST_SECRET)

      expect(verified2).toBeDefined()
      if (!verified2) throw new Error('expected verified token')
      expect(verified2.idx).toBe(1)
      expect(verified2.rid).toBe(verified1.rid) // Same round
      expect(token1).not.toBe(token2) // Different tokens
    })

    it('maintains round consistency across multiple regenerations', async () => {
      let currentPayload = { ...validPayload, idx: 0 }
      const roundId = currentPayload.rid
      let lastToken = await createJWSToken(currentPayload, TEST_SECRET, TEST_TTL)

      // Simulate walking through 5 questions
      for (let i = 1; i < 5; i++) {
        const verified = await verifyJWSToken(lastToken, TEST_SECRET)
        expect(verified).toBeDefined()
        if (!verified) throw new Error('expected verified token')

        currentPayload = {
          rid: verified.rid,
          idx: verified.idx + 1,
          total: verified.total,
          seed: verified.seed,
          filtersHash: verified.filtersHash,
          filtersKey: verified.filtersKey,
          ver: verified.ver,
        }

        lastToken = await createJWSToken(currentPayload, TEST_SECRET, TEST_TTL)
      }

      // Verify final token
      const finalVerified = await verifyJWSToken(lastToken, TEST_SECRET)
      expect(finalVerified).toBeDefined()
      if (!finalVerified) throw new Error('expected verified token')
      expect(finalVerified.rid).toBe(roundId) // Same round throughout
      expect(finalVerified.idx).toBe(4) // Correct position
    })
  })
})

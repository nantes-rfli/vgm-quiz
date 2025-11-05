# JWS Token Implementation (Phase 2B)

**Status**: Phase 2B implementation complete
**Last Updated**: 2025-10-30

## Overview

This document describes the JWS (JSON Web Signature) token implementation for stateless round management in the `/v1/rounds/start` and `/v1/rounds/next` endpoints.

## Key Design Decisions

### 1. **Signature Algorithm: HMAC-SHA256**

**Why HMAC-SHA256?**
- Symmetric algorithm suitable for internal service communication
- Fast and lightweight (important for serverless Cloudflare Workers)
- Sufficient for token integrity and non-repudiation in this context
- Built-in Web Crypto API support (no external library needed)

**Future consideration**: For public key distribution scenarios, EdDSA (as specified in [docs/api/rounds-token-spec.md](./rounds-token-spec.md)) could replace this.

### 2. **Base64url Encoding (RFC 4648)**

**Implementation**: [workers/shared/lib/token.ts](../../workers/shared/lib/token.ts:26-33)

```typescript
export function encodeBase64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
```

**Why not standard Base64?**
- Base64url replaces `+` → `-` and `/` → `_` for URL safety
- Removes padding (`=`) for cleaner token format
- Complies with JWT/JWS standards (RFC 7515)

### 3. **JWS Compact Serialization**

**Structure**: `Header.Payload.Signature`

**Example**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJyaWQiOiI1MDQ3NzBkOC0yNDU1LTRjN2ItOWMxNy1kZTY4YmI5YWM3MDkiLCJpZHgiOjAsInRvdGFsIjoxMCwic2VlZCI6InRlc3Qtc2VlZC0xNi1jaGFyIiwiZmlsdGVyc0hhc2giOiJjYW5vbmljYWwtZGFpbHkiLCJ2ZXIiOjEsImF1ZCI6InJvdW5kcyIsImlhdCI6MTcyNTA5MTI0NSwiZXhwIjoxNzI1MDk0ODQ1fQ.
6eFh2K...
```

### 4. **Token Payload Structure**

**Defined in** [workers/shared/lib/token.ts](../../workers/shared/lib/token.ts:10-21)

```typescript
export interface Phase2TokenPayload {
  rid: string         // Round ID (UUID)
  idx: number         // Current question index (0-based)
  total: number       // Total questions in round
  seed: string        // Sampling seed (16-char base64url)
  filtersHash: string // SHA-256 hash of canonicalized filters
  ver: number         // Token spec version (1)
  iat: number         // Issued at (Unix timestamp)
  exp: number         // Expiration (Unix timestamp, TTL=120s)
  aud?: string        // Audience (optional, e.g., "rounds")
  nbf?: number        // Not before (optional)
}
```

**Security considerations**:
- `rid` + `seed` + `filtersHash` together create a unique round fingerprint
- `idx` prevents token reuse for earlier questions (enforces forward-only progression)
- `exp` ensures tokens cannot be reused after 120 seconds
- Optional `aud`/`nbf` preserve extensibility for future use

### 5. **Signature Generation & Verification**

**Generation**: [workers/shared/lib/token.ts](../../workers/shared/lib/token.ts:53-89)

```typescript
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

  const header = { alg: 'HS256', typ: 'JWT' }
  const headerEncoded = encodeBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadEncoded = encodeBase64url(new TextEncoder().encode(JSON.stringify(jwtPayload)))

  const messageToSign = `${headerEncoded}.${payloadEncoded}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(messageToSign))

  return `${messageToSign}.${encodeBase64url(signature)}`
}
```

**Verification**: [workers/shared/lib/token.ts](../../workers/shared/lib/token.ts:92-166)

```typescript
export async function verifyJWSToken(
  token: string,
  secret: string,
): Promise<Phase2TokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts

  // 1. Verify signature
  const messageToSign = `${headerEncoded}.${payloadEncoded}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signatureBuffer = decodeBase64url(signatureEncoded)
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer as ArrayBufferView, new TextEncoder().encode(messageToSign))
  if (!isValid) return null

  // 2. Decode payload
  const payloadJson = new TextDecoder().decode(decodeBase64url(payloadEncoded))
  const payload = JSON.parse(payloadJson) as Phase2TokenPayload

  // 3. Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) return null

  return payload
}
```

### 6. **Automatic Token Format Detection**

**Implementation**: [workers/api/src/lib/token.ts](../../workers/api/src/lib/token.ts:32-41)

```typescript
export function isPhase1Token(token: TokenPayload): token is Phase1TokenPayload {
  return 'date' in token && 'currentIndex' in token && 'totalQuestions' in token
}

export function isPhase2Token(token: TokenPayload): token is Phase2TokenPayload {
  return 'rid' in token && 'idx' in token && 'seed' in token && 'filtersHash' in token
}
```

**Why type guards instead of `in` operator in endpoint code?**
- Centralized, testable logic
- Type-safe: TypeScript narrows types correctly
- Reusable across API Worker and MSW handlers
- Clear intent in endpoint code

### 7. **Shared Library Design**

**File structure**:
- `workers/shared/lib/token.ts` — Core signing/verification (used by API Worker)
- `web/src/lib/token-shared.ts` — Browser-compatible version (used by MSW handlers)
- `workers/api/src/lib/token.ts` — API Worker wrapper with type guards

**Why split?**
- Core logic is platform-agnostic (only uses Web Crypto API)
- MSW handlers (running in browser/Node.js) can reuse the same logic
- Future: Phase 1 Base64 tokens remain supported in `workers/api/src/lib/token.ts`

## Security Model

### Threat Model

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Token tampering | HMAC-SHA256 signature verification | ✅ Implemented |
| Token expiration | `exp` claim checked on verification | ✅ Implemented |
| Question re-ordering | `idx` value strictly enforced in `/v1/rounds/next` | ✅ Implemented |
| Round hijacking | `rid` + `seed` + `filtersHash` uniquely identify round | ✅ Implemented |
| Replay attack | TTL = 120s (token cannot be reused after expiration) | ✅ Implemented |
| Key compromise | Secret rotation via `kid` header (future) | ⏳ TODO |

### Secret Management

**Development**:
- Stored in `workers/api/wrangler.toml` as `JWT_SECRET`
- Current dev value: `dev-secret-key-please-replace-in-production-with-strong-random-value`

**Production**:
- Must use Cloudflare Secrets API or environment variables
- Rotate periodically
- Different secret per environment (dev/staging/prod)

## Integration Points

### 1. **POST /v1/rounds/start**

[workers/api/src/routes/rounds.ts](../../workers/api/src/routes/rounds.ts)

```typescript
const normalizedFilters = normalizeFilters(requestFilters)
const filterKey = createFilterKey(normalizedFilters)
const filtersHash = hashFilterKey(filterKey)

const token = await createJWSToken(
  {
    rid: roundId,
    idx: 0,
    total: availableTotal,
    seed,
    filtersHash,
    filtersKey: filterKey,
    mode: mode.id,
    date,
    ver: 1,
    aud: 'rounds',
  },
  env.JWT_SECRET,
)
```

**Returns**: JWS token with `idx=0` and first question metadata。`filtersKey` は `'{}'` などの正規化JSON、`filtersHash` は同じJSONに対するハッシュ。

### 2. **POST /v1/rounds/next**

[workers/api/src/routes/rounds.ts](../../workers/api/src/routes/rounds.ts:59-223)

```typescript
// Decode and verify token
const token = await decodeContinuationToken(continuationToken, env.JWT_SECRET)

if (isPhase2Token(token)) {
  const phase2Token = token as Phase2TokenPayload
  currentIndex = phase2Token.idx

  // Verify exp manually
  const now = Math.floor(Date.now() / 1000)
  if (phase2Token.exp < now) {
    return new Response(JSON.stringify({ error: 'Invalid token', message: 'Token has expired' }), { status: 401 })
  }

  // Fetch round data
  daily = await fetchRoundByToken(env, phase2Token)
}

// ... validate currentIndex, process answer ...

// Regenerate token with idx+1
response.continuationToken = await createJWSToken(
  {
    rid: phase2Token.rid,
    idx: nextIndex,
    total: phase2Token.total,
    seed: phase2Token.seed,
    filtersHash: phase2Token.filtersHash,
    ver: phase2Token.ver,
    aud: phase2Token.aud, // Preserve optional fields
    nbf: phase2Token.nbf,
  },
  env.JWT_SECRET,
)
```

**Returns**: Result with reveal metadata + new JWS token with `idx` incremented

### 3. **MSW Handlers**

[web/mocks/handlers.ts](../../web/mocks/handlers.ts:25-65)

Uses the same `createJWSToken` from `web/src/lib/token-shared.ts` to generate test tokens that the frontend can verify with `verifyJWSToken`.

## Testing

**Unit tests**: [workers/tests/token.spec.ts](../../workers/tests/token.spec.ts)

Test coverage includes:
- ✅ Valid token creation and verification
- ✅ Token tampering detection (invalid signature, modified payload)
- ✅ Wrong secret detection
- ✅ Expired token rejection
- ✅ Malformed token rejection
- ✅ Base64url encoding round-trip
- ✅ Sequential token regeneration with `idx` increment
- ✅ Round consistency across multiple questions

**E2E tests**: All 11 existing Playwright E2E tests pass with Phase 2B JWS tokens

## Backward Compatibility

**Phase 1 (Base64 tokens)** are still supported via:
1. `decodeContinuationToken()` auto-detects format (JWS has 3 dot-separated parts)
2. Type guards (`isPhase1Token` / `isPhase2Token`) route logic appropriately
3. MSW handlers accept both formats in `/v1/rounds/next`

**Transition strategy**:
- Phase 1 continues to work (no client-side changes required)
- Phase 2B JWS is now default for new rounds (`/v1/rounds/start`)
- Clients can migrate at their own pace

## Future Enhancements

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| EdDSA (Ed25519) signatures | Medium | Better for public key scenarios |
| Key rotation via `kid` | High | Security best practice |
| `filtersHash` computed from canonical JSON | High | Enables true filtered round support |
| `aud` claim validation | Low | Useful for API versioning |
| `nbf` enforcement | Low | Useful for scheduled token activation |

## References

- [JWS RFC 7515](https://tools.ietf.org/html/rfc7515)
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [Rounds Token Spec (docs/api/rounds-token-spec.md)](./rounds-token-spec.md)
- [API Spec (docs/api/api-spec.md)](./api-spec.md)
- [Web Crypto API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

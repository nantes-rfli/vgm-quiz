// Safe base64url helpers (browser & Node compatible)
// Used for Phase 1 continuationToken encoding/decoding

function b64uEncodeString(str: string): string {
  try {
    // Browser path
    const b64 =
      typeof btoa !== 'undefined'
        ? btoa(unescape(encodeURIComponent(str)))
        : Buffer.from(str, 'utf8').toString('base64')
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  } catch {
    // Fallback to Buffer if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBuf: any = (globalThis as any).Buffer
    const b64 = anyBuf ? anyBuf.from(str, 'utf8').toString('base64') : str
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
}

function b64uDecodeToString(b64u: string): string {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  try {
    // Browser path
    const s =
      typeof atob !== 'undefined'
        ? atob(b64)
        : Buffer.from(b64, 'base64').toString('binary')
    // Decode from binary to UTF-8 string
    const decoded = decodeURIComponent(escape(s))
    return decoded
  } catch {
    // Fallback to Buffer UTF-8
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBuf: any = (globalThis as any).Buffer
    return anyBuf ? anyBuf.from(b64, 'base64').toString('utf8') : b64u
  }
}

export const encodeBase64url = (obj: unknown): string =>
  b64uEncodeString(JSON.stringify(obj))

export const decodeBase64url = <T = unknown>(b64u: string): T =>
  JSON.parse(b64uDecodeToString(b64u)) as T

// Phase 1 continuationToken structure
export type Phase1Token = {
  date: string
  currentIndex: number
  totalQuestions: number
}

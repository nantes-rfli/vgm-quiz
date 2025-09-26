// Clean MSW handlers with JWS-like token and fixtures for 10 questions
import { http, HttpResponse } from 'msw';
import startRound from './fixtures/rounds.start.ok.json';
import { TOTAL as ROUND_TOTAL, getQuestionByIndex } from './fixtures/rounds/index';
import { ANSWERS } from './fixtures/rounds/answers';

type Claims = { rid: string; idx: number; total: number; iat: number; exp: number };
const ALG = { alg: 'EdDSA', kid: 'mock-key' as const };
// --- Safe base64url helpers (browser & Node) ---
function b64uEncodeString(str: string): string {
  try {
    // Browser path
    const b64 = typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    // Fallback to Buffer if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBuf: any = (globalThis as any).Buffer;
    const b64 = anyBuf ? anyBuf.from(str, 'utf8').toString('base64') : str;
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}

function b64uDecodeToString(b64u: string): string {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  try {
    // Browser path
    const s = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    // Decode from binary to UTF-8 string
    const decoded = decodeURIComponent(escape(s));
    return decoded;
  } catch {
    // Fallback to Buffer UTF-8
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBuf: any = (globalThis as any).Buffer;
    return anyBuf ? anyBuf.from(b64, 'base64').toString('utf8') : b64u;
  }
}

const enc = (obj: unknown) => b64uEncodeString(JSON.stringify(obj));
const dec = (b64u: string): unknown => JSON.parse(b64uDecodeToString(b64u));
function buildReveal(answer?: { questionId?: string; choiceId?: string } | null) {
  if (!answer?.questionId || !answer?.choiceId) return undefined;
  const correctChoiceId = ANSWERS[answer.questionId];
  const correct = correctChoiceId ? correctChoiceId === answer.choiceId : false;
  return {
    questionId: answer.questionId,
    choiceId: answer.choiceId,
    correct,
    correctChoiceId: correctChoiceId || undefined,
    links: [], // links are available via previous question's reveal on client; server can omit or fill if needed
  };
}


function sign(claims: Claims): string {
  const header = enc(ALG);
  const payload = enc(claims);
  const sig = b64uEncodeString('mock-signature');
  return `${header}.${payload}.${sig}`;
}
function verify(token: string): Claims {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw Object.assign(new Error('malformed'), { status: 401 });
  const header = dec(h) as { alg: string };
  if (header.alg !== 'EdDSA') throw Object.assign(new Error('alg'), { status: 401 });
  const claims = dec(p) as Claims;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && now >= claims.exp) throw Object.assign(new Error('expired'), { status: 401 });
  return claims;
}
function nextToken(prev: Claims): Claims {
  return { ...prev, idx: prev.idx + 1, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
}

export const handlers = [
  http.post('/v1/rounds/start', async () => {
    const rid = 'r-clean';
    const total = ROUND_TOTAL;
    const claims: Claims = { rid, idx: 1, total, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = sign(claims);

    // JSON importの型付け回避: 型アサーションではなく unknown 経由に変更
    const question = (startRound as unknown as { question: unknown }).question;

    return HttpResponse.json({
      round: { token, progress: { index: 1, total } },
      question,
      finished: false,
    });
  }),

  http.post('/v1/rounds/next', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string; answer?: { questionId?: string; choiceId?: string } };
    const token = body?.token;
    if (!token) return new HttpResponse('Missing token', { status: 400 });
    let claims: Claims;
    try {
      claims = verify(token);
    } catch (e) {
      const err = e as Error & { status?: number };
      return new HttpResponse(err.message || 'Invalid token', { status: err.status || 401 });
    }
    const next = nextToken(claims);
    const isFinished = next.idx > next.total;

    const newToken = sign(next);
    if (isFinished) {
      // Even when finished, return reveal for the last answered question if provided
      const rev = buildReveal(body?.answer);
      return HttpResponse.json({ round: { token: newToken, progress: { index: next.total, total: next.total } }, finished: true, reveal: rev });
    }

    const question = getQuestionByIndex(next.idx);
    const rev = buildReveal(body?.answer);
    return HttpResponse.json({
      round: { token: newToken, progress: { index: next.idx, total: next.total } },
      question,
      finished: false,
      reveal: rev,
    });
  }),

  http.post('/v1/metrics', async () => new HttpResponse(null, { status: 202 })),
];

export default handlers;
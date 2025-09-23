// Clean MSW handlers with JWS-like token and fixtures for 10 questions
import { http, HttpResponse } from 'msw';
import startRound from './fixtures/rounds.start.ok.json';
import { TOTAL as ROUND_TOTAL, getQuestionByIndex } from './fixtures/rounds/index';

type Claims = { rid: string; idx: number; total: number; iat: number; exp: number };
const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const dec = (b64: string): unknown => JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
const ALG = { alg: 'EdDSA', kid: 'mock-key' as const };

function sign(claims: Claims): string {
  const header = enc(ALG);
  const payload = enc(claims);
  const sig = Buffer.from('mock-signature').toString('base64url');
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
    const body = (await request.json().catch(() => ({}))) as { token?: string };
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
      return HttpResponse.json({
        round: { token: newToken, progress: { index: next.total, total: next.total } },
        finished: true,
      });
    }
    const question = getQuestionByIndex(next.idx);
    return HttpResponse.json({
      round: { token: newToken, progress: { index: next.idx, total: next.total } },
      question,
      finished: false,
    });
  }),

  http.post('/v1/metrics', async () => new HttpResponse(null, { status: 202 })),
];

export default handlers;

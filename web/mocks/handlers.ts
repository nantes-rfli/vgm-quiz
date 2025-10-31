// MSW handlers for Phase 1 (Base64 tokens) and Phase 2B (JWS tokens)
// During development, both token formats are supported for backward compatibility
import { http, HttpResponse } from 'msw';
import { TOTAL as ROUND_TOTAL, getQuestionByIndex } from './fixtures/rounds/index';
import { ANSWERS } from './fixtures/rounds/answers';
import { META } from './fixtures/rounds/meta';
import { encodeBase64url, decodeBase64url, type Phase1Token } from '@/src/lib/base64url';
import { createJWSToken, verifyJWSToken, isJWSToken, type Phase2TokenPayload } from '@/src/lib/token-shared';

// Browser-compatible UUID generation (using crypto.getRandomValues)
function generateUUID(): string {
  // Generate 16 random bytes
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);

  // Set version (4) and variant bits
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // variant 1

  // Format as UUID string
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const enc = encodeBase64url;
const dec = decodeBase64url;

// Shared secret for JWS token signing in development (same as wrangler.toml dev value)
const JWT_SECRET = 'dev-secret-key-please-replace-in-production-with-strong-random-value';

/**
 * Generate a hash for empty filters (canonical round)
 * Phase 2B: All question sets are keyed by filtersHash for consistency
 */
function getCanonicalFiltersHash(): string {
  return 'canonical-daily';
}

export const handlers = [
  // Phase 2B: GET /v1/rounds/start (JWS token format)
  http.get('/v1/rounds/start', async () => {
    try {
      const total = ROUND_TOTAL;

      // Get first question
      const firstQuestion = getQuestionByIndex(1);
      if (!firstQuestion) {
        return new HttpResponse('No questions available', { status: 503 });
      }

      // Create Phase 2B JWS token
      const roundId = generateUUID();
      const seed = generateUUID().replace(/-/g, '').substring(0, 16);
      const filtersHash = getCanonicalFiltersHash();

      const token = await createJWSToken(
        {
          rid: roundId,
          idx: 0,
          total,
          seed,
          filtersHash,
          ver: 1,
          aud: 'rounds',
        },
        JWT_SECRET,
      );

      return HttpResponse.json({
        question: {
          id: firstQuestion.id,
          title: firstQuestion.prompt,
        },
        choices: firstQuestion.choices.map((c) => ({
          id: c.id,
          text: c.label,
        })),
        continuationToken: token,
        progress: {
          index: 1, // 1-based: first question
          total,
        },
      });
    } catch (err) {
      console.error('[MSW] GET /v1/rounds/start error:', err);
      return new HttpResponse(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),

  // Phase 1 & 2B: POST /v1/rounds/next
  http.post('/v1/rounds/next', async ({ request }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        continuationToken?: string;
        answer?: string;
      };

      const { continuationToken, answer } = body;
      if (!continuationToken) {
        return new HttpResponse('Missing continuationToken', { status: 400 });
      }

      // Try to decode token - support both Phase 1 (Base64) and Phase 2B (JWS)
      let token: Phase1Token | null = null;
      let isPhase2 = false;
      let phase2Token: Phase2TokenPayload | null = null;

      if (isJWSToken(continuationToken)) {
        // Phase 2B: JWS token verification
        const jwtToken = await verifyJWSToken(continuationToken, JWT_SECRET);
        if (!jwtToken) {
          return new HttpResponse(
            JSON.stringify({
              error: 'Invalid token',
              message: 'Continuation token is invalid or expired',
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        isPhase2 = true;
        phase2Token = jwtToken;
        // Convert Phase 2 token to Phase 1 format for internal processing
        token = {
          date: new Date().toISOString().split('T')[0],
          currentIndex: jwtToken.idx,
          totalQuestions: jwtToken.total,
        };
      } else {
        // Phase 1: Base64 token
        try {
          token = dec(continuationToken) as Phase1Token;
        } catch {
          return new HttpResponse(
            JSON.stringify({
              error: 'Invalid token',
              message: 'Continuation token is invalid or expired',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (!token) {
        return new HttpResponse(
          JSON.stringify({
            error: 'Invalid token',
            message: 'Continuation token is invalid or expired',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get current question for reveal
      const currentQuestion = getQuestionByIndex(token.currentIndex + 1);
      if (!currentQuestion) {
        return new HttpResponse('Question not found', { status: 404 });
      }

      // Check answer correctness
      const correctChoiceId = ANSWERS[currentQuestion.id];
      const correct = answer === correctChoiceId;

      // Prepare reveal metadata
      const revealMeta = META[currentQuestion.id] || {};

      const nextIndex = token.currentIndex + 1;
      const finished = nextIndex >= token.totalQuestions;

      if (finished) {
        // Last question - no next question
        return HttpResponse.json({
          result: {
            correct,
            correctAnswer: correctChoiceId || 'a',
            reveal: {
              title: revealMeta.trackTitle || 'Unknown Track',
              game: revealMeta.workTitle || 'Unknown Game',
              composer: revealMeta.composer,
              youtube_url: revealMeta.youtube_url,
              spotify_url: revealMeta.spotify_url,
            },
          },
          progress: {
            // Show total when finished (last question)
            index: token.totalQuestions,
            total: token.totalQuestions,
          },
          finished: true,
        });
      }

      // Get next question
      const nextQuestion = getQuestionByIndex(nextIndex + 1);
      if (!nextQuestion) {
        return new HttpResponse('Next question not found', { status: 500 });
      }

      // Generate next token based on input type (Phase 1 Base64 or Phase 2B JWS)
      let nextToken: string;
      if (isPhase2 && phase2Token) {
        // Phase 2B: Generate JWS token
        nextToken = await createJWSToken(
          {
            rid: phase2Token.rid,
            idx: nextIndex,
            total: phase2Token.total,
            seed: phase2Token.seed,
            filtersHash: phase2Token.filtersHash,
            ver: phase2Token.ver,
            ...(phase2Token.aud && { aud: phase2Token.aud }),
            ...(phase2Token.nbf && { nbf: phase2Token.nbf }),
          },
          JWT_SECRET,
        );
      } else {
        // Phase 1: Generate Base64 token
        nextToken = enc({
          date: token.date,
          currentIndex: nextIndex,
          totalQuestions: token.totalQuestions,
        });
      }

      return HttpResponse.json({
        result: {
          correct,
          correctAnswer: correctChoiceId || 'a',
          reveal: {
            title: revealMeta.trackTitle || 'Unknown Track',
            game: revealMeta.workTitle || 'Unknown Game',
            composer: revealMeta.composer,
            youtube_url: revealMeta.youtube_url,
            spotify_url: revealMeta.spotify_url,
          },
        },
        question: {
          id: nextQuestion.id,
          title: nextQuestion.prompt,
        },
        choices: nextQuestion.choices.map((c) => ({
          id: c.id,
          text: c.label,
        })),
        continuationToken: nextToken,
        progress: {
          index: nextIndex + 1, // 1-based
          total: token.totalQuestions,
        },
        finished: false,
      });
    } catch (err) {
      console.error('[MSW] POST /v1/rounds/next error:', err);
      return new HttpResponse(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),

  http.post('/v1/metrics', async () => new HttpResponse(null, { status: 202 })),
];

export default handlers;
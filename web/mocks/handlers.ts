// MSW handlers for Phase 1 (Base64 tokens) and Phase 2B (JWS tokens)
// During development, both token formats are supported for backward compatibility
import { http, HttpResponse } from 'msw';
import { TOTAL as ROUND_TOTAL, getQuestionByIndex, getFirstQuestionByFilters, getFirstQuestionByMode } from './fixtures/rounds/index';
import { ANSWERS, FILTER_ANSWERS } from './fixtures/rounds/answers';
import { META } from './fixtures/rounds/meta';
import { encodeBase64url, decodeBase64url, type Phase1Token } from '@/src/lib/base64url';
import { createJWSToken, verifyJWSToken, isJWSToken, type Phase2TokenPayload } from '@/src/lib/token-shared';
import type { Manifest, Difficulty, Era } from '@/src/features/quiz/api/manifest';

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

const CANONICAL_FILTER_KEY = '{}';

interface StartFilters {
  difficulty?: string | string[];
  era?: string | string[];
  series?: string[];
}

interface StartRequestBody {
  mode?: string;
  filters?: StartFilters;
  total?: number;
  seed?: string;
}

function normalizeFilters(filters?: StartFilters): StartFilters {
  if (!filters) return {};

  const normalized: StartFilters = {};

  if (filters.difficulty) {
    const values = Array.isArray(filters.difficulty) ? filters.difficulty : [filters.difficulty];
    const candidate = values.find((value) => value && value !== 'mixed');
    if (candidate) {
      normalized.difficulty = candidate;
    }
  }

  if (filters.era) {
    const values = Array.isArray(filters.era) ? filters.era : [filters.era];
    const candidate = values.find((value) => value && value !== 'mixed');
    if (candidate) {
      normalized.era = candidate;
    }
  }

  if (filters.series && filters.series.length > 0) {
    const uniqueSeries = Array.from(new Set(filters.series.map((value) => value.trim()).filter(Boolean)));
    if (uniqueSeries.length > 0) {
      normalized.series = uniqueSeries.sort();
    }
  }

  return normalized;
}

function createFilterKey(filters?: StartFilters, modeId?: string): string {
  const normalized = normalizeFilters(filters);
  const payload: Record<string, unknown> = {};

  if (modeId) {
    payload.mode = modeId;
  }

  const sortedKeys = Object.keys(normalized).sort();

  for (const key of sortedKeys) {
    const value = normalized[key as keyof StartFilters];
    if (Array.isArray(value)) {
      payload[key] = value.slice().sort();
    } else if (value !== undefined) {
      payload[key] = value;
    }
  }

  if (Object.keys(payload).length === 0) {
    return CANONICAL_FILTER_KEY;
  }

  return JSON.stringify(payload);
}

function hashFilterKey(filterKey: string): string {
  let hash = 0;
  for (let i = 0; i < filterKey.length; i += 1) {
    const charCode = filterKey.charCodeAt(i);
    hash = (hash << 5) - hash + charCode;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const handlers = [
  // Phase 2B: GET /v1/manifest - Describe available modes, facets, and features
  http.get('*/v1/manifest', () => {
    const manifest: Manifest = {
      schema_version: 2,
      modes: [
        {
          id: 'vgm_v1-ja',
          title: 'VGM Quiz Vol.1 (JA)',
          defaultTotal: 10,
        },
        {
          id: 'vgm_composer-ja',
          title: '作曲者モード (JA)',
          defaultTotal: 10,
        },
      ],
      facets: {
        difficulty: ['easy', 'normal', 'hard', 'mixed'],
        era: ['80s', '90s', '00s', '10s', '20s', 'mixed'],
        series: ['ff', 'dq', 'zelda', 'mario', 'sonic', 'pokemon', 'mixed'],
      },
      features: {
        inlinePlaybackDefault: false,
        imageProxyEnabled: false,
        composerModeEnabled: true,
      },
    };

    return HttpResponse.json(manifest);
  }),

  // Phase 2B: POST /v1/rounds/start (JWS token format with filter support)
  http.post('*/v1/rounds/start', async ({ request }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as StartRequestBody;
      const filters = normalizeFilters(body.filters);

      const difficulty = filters.difficulty as Difficulty | undefined;
      const era = filters.era as Era | undefined;
      const series = filters.series ?? [];

      const total = body.total && Number.isInteger(body.total) ? Math.min(body.total, ROUND_TOTAL) : ROUND_TOTAL;

      // Get first question based on mode/filters (Phase 2B)
      // If composer mode, return composer fixture; else filter-specific/default
      const firstQuestion = getFirstQuestionByMode(body.mode, difficulty, era, series);
      if (!firstQuestion) {
        return HttpResponse.json(
          { error: 'no_questions', message: 'No questions available for the selected filters' },
          { status: 503 }
        );
      }

      // Create Phase 2B JWS token with filter info
      const roundId = generateUUID();
      const seed = generateUUID().replace(/-/g, '').substring(0, 16);
      const filterKey = createFilterKey(filters, body.mode ?? 'vgm_v1-ja');
      const filtersHash = hashFilterKey(filterKey);
      const date = new Date().toISOString().split('T')[0];

      const arm = 'treatment';

      const token = await createJWSToken(
        {
          rid: roundId,
          idx: 0,
          total,
          seed,
          filtersHash,
          filtersKey: filterKey,
          mode: body.mode ?? 'vgm_v1-ja',
          arm,
          date,
          ver: 1,
          aud: 'rounds',
        },
        JWT_SECRET,
      );

      return HttpResponse.json({
        round: {
          id: roundId,
          mode: body.mode ?? 'vgm_v1-ja',
          arm,
          date,
          filters,
          progress: {
            index: 1,
            total,
          },
          token,
        },
        question: {
          id: firstQuestion.id,
          title: firstQuestion.prompt,
          mode: body.mode ?? 'vgm_v1-ja',
          arm,
        },
        choices: firstQuestion.choices.map((c) => ({
          id: c.id,
          text: c.label,
        })),
        continuationToken: token,
        progress: {
          index: 1,
          total,
        },
      });
    } catch (err) {
      console.error('[MSW] POST /v1/rounds/start error:', err);
      return new HttpResponse(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),

  // Phase 1 & 2B: POST /v1/rounds/next
  http.post('*/v1/rounds/next', async ({ request }) => {
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
      let arm = 'treatment';
      let mode = 'vgm_v1-ja';

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
        arm = jwtToken.arm ?? arm;
        mode = jwtToken.mode ?? mode;
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
      // Phase 2B: Only use filter-specific question for the first question (currentIndex === 0)
      // For subsequent questions, use default fixture based on index
      let currentQuestion;
      if (isPhase2 && phase2Token && token.currentIndex === 0) {
        // First question: restore filters from filtersHash and retrieve question with same filter
        const filtersStr = phase2Token.filtersHash;
        if (filtersStr !== 'canonical-daily' && filtersStr) {
          // Parse key=value|key=value format
          let difficulty: Difficulty | undefined;
          let era: Era | undefined;
          let series: string[] | undefined;

          const filterPairs = filtersStr.split('|');
          for (const pair of filterPairs) {
            const [key, value] = pair.split('=');
            if (key === 'difficulty' && value) {
              difficulty = value as Difficulty;
            } else if (key === 'era' && value) {
              era = value as Era;
            } else if (key === 'series' && value) {
              series = value.split(',');
            }
          }

          currentQuestion = getFirstQuestionByFilters(difficulty, era, series);
        } else {
          currentQuestion = getQuestionByIndex(token.currentIndex + 1);
        }
      } else {
        // Phase 1 or Phase 2B (not first question): Use default fixture based on index
        currentQuestion = getQuestionByIndex(token.currentIndex + 1);
      }

      if (!currentQuestion) {
        return new HttpResponse('Question not found', { status: 404 });
      }

      // Check answer correctness
      // Phase 2B: Check FILTER_ANSWERS first for filter-specific questions, then ANSWERS for defaults
      const correctChoiceId = FILTER_ANSWERS[currentQuestion.id] || ANSWERS[currentQuestion.id];
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
      // Phase 2B: Use same filter as start request if present
      let nextQuestion;
      if (isPhase2 && phase2Token) {
        // For Phase 2B filtered rounds, continue with default fixture sequence
        // (filter applies only to first question for MVP implementation)
        nextQuestion = getQuestionByIndex(nextIndex + 1);
      } else {
        // Phase 1: Use default fixture
        nextQuestion = getQuestionByIndex(nextIndex + 1);
      }

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
            filtersKey: phase2Token.filtersKey,
            ver: phase2Token.ver,
            arm,
            mode,
            ...(phase2Token.aud && { aud: phase2Token.aud }),
            ...(phase2Token.nbf && { nbf: phase2Token.nbf }),
            ...(phase2Token.date && { date: phase2Token.date }),
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
          mode,
          arm,
        },
        choices: nextQuestion.choices.map((c) => ({
          id: c.id,
          text: c.label,
        })),
        continuationToken: nextToken,
        round: isPhase2
          ? {
              mode,
              arm,
            }
          : undefined,
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

  http.post('*/v1/metrics', async () => new HttpResponse(null, { status: 202 })),

  // Phase 2B: POST /v1/availability - Count available tracks for given filters
  http.post('*/v1/availability', async ({ request }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        mode?: string;
        filters?: unknown;
      };

      if (!body.mode) {
        return new HttpResponse(
          JSON.stringify({
            error: {
              code: 'bad_request',
              message: 'mode is required',
              details: { pointer: '/mode' },
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate filter format (must be arrays, not strings/numbers/objects)
      if (body.filters && typeof body.filters === 'object') {
        const filterObj = body.filters as Record<string, unknown>;
        if (
          ('difficulty' in filterObj && !Array.isArray(filterObj.difficulty)) ||
          ('era' in filterObj && !Array.isArray(filterObj.era)) ||
          ('series' in filterObj && !Array.isArray(filterObj.series))
        ) {
          return new HttpResponse(
            JSON.stringify({
              error: {
                code: 'bad_request',
                message: 'filters must be an object with array-valued facets (difficulty, era, series)',
                details: { pointer: '/filters' },
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // For MVP implementation with MSW mocks, return a fixed count of available tracks
      // In a real scenario, this would query the database and count matching tracks
      // Simulate with reasonable counts based on filter specificity
      const filters = body.filters as {
        difficulty?: Difficulty[];
        era?: Era[];
        series?: string[];
      } | undefined;
      let available = 50; // Default count for all tracks

      // Adjust availability based on filter specificity
      // This is a simulation - in production, this would be a real database query
      // Difficulty filter (array): if present and not 'mixed', reduces availability
      if (filters?.difficulty && filters.difficulty.length > 0) {
        const hasMixed = filters.difficulty.includes('mixed');
        if (!hasMixed) {
          available = 40; // Difficulty filter reduces availability
        }
      }
      // Era filter (array): if present and not 'mixed', further reduces
      if (filters?.era && filters.era.length > 0) {
        const hasMixed = filters.era.includes('mixed');
        if (!hasMixed) {
          available = Math.max(20, available - 10); // Era filter further reduces
        }
      }
      // Series filter (array): most restrictive
      if (filters?.series && filters.series.length > 0) {
        const hasMixed = filters.series.includes('mixed');
        if (!hasMixed) {
          available = Math.max(14, available - 15); // Series filter significantly reduces
        }
      }

      return HttpResponse.json({ available });
    } catch (err) {
      console.error('[MSW] POST /v1/availability error:', err);
      return new HttpResponse(
        JSON.stringify({
          error: {
            code: 'server_error',
            message: 'Internal server error',
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }),
];

export default handlers;

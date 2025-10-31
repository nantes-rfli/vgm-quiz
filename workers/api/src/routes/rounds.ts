import { getTodayJST } from '../../../shared/lib/date'
import type { Env } from '../../../shared/types/env'
import type { DailyExport } from '../../../shared/types/export'
import { fetchDailyQuestions, fetchRoundByToken } from '../lib/daily'
import {
  type Phase1TokenPayload,
  type Phase2TokenPayload,
  createContinuationToken,
  createJWSToken,
  decodeContinuationToken,
  isPhase1Token,
  isPhase2Token,
} from '../lib/token'

/**
 * Generate a UUID v4 using Web Crypto API (compatible with Cloudflare Workers)
 */
function generateUUID(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40 // version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80 // variant 1
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Generate a hash for empty filters (canonical round)
 * Phase 2B: All question sets are keyed by filtersHash for consistency
 */
function getCanonicalFiltersHash(): string {
  // SHA-256 hash of '{}' (canonical filters)
  // For MVP, use a fixed value to represent canonical daily questions
  // TODO: Compute actual SHA-256 hash of canonical filters JSON
  return 'canonical-daily'
}

/**
 * GET /v1/rounds/start - Start a new round
 * Phase 1 (legacy): Returns Base64 continuation token
 * Phase 2B (current): Returns JWS signed continuation token
 */
export async function handleRoundsStart(request: Request, env: Env): Promise<Response> {
  // Get today's question set
  const date = getTodayJST()
  const daily = await fetchDailyQuestions(env, date)

  if (!daily) {
    return new Response(
      JSON.stringify({ error: 'No questions available', message: 'No question set for today' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Return first question
  const firstQuestion = daily.questions[0]

  // Create continuation token (Phase 2B: JWS format)
  // For Phase 2B, always use JWS token format
  // Phase 1 compatibility: Clients can still handle Base64 tokens if needed
  const roundId = generateUUID()
  const seed = generateUUID().replace(/-/g, '').substring(0, 16) // 16-char base64url compatible seed
  const filtersHash = getCanonicalFiltersHash()

  const token = await createJWSToken(
    {
      rid: roundId,
      idx: 0,
      total: daily.questions.length,
      seed,
      filtersHash,
      ver: 1,
      aud: 'rounds',
    },
    env.JWT_SECRET,
  )

  return new Response(
    JSON.stringify({
      question: {
        id: firstQuestion.id,
        title: 'この曲のゲームタイトルは?',
      },
      choices: firstQuestion.choices.map((c) => ({ id: c.id, text: c.text })),
      continuationToken: token,
      progress: {
        index: 1, // 1-based: first question
        total: daily.questions.length,
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}

/**
 * POST /v1/rounds/next - Get next question
 */
export async function handleRoundsNext(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { continuationToken: string; answer: string }
  const { continuationToken, answer } = body

  // 1. Decode token (with JWT secret for Phase 2B tokens)
  const token = await decodeContinuationToken(continuationToken, env.JWT_SECRET)
  if (!token) {
    return new Response(
      JSON.stringify({
        error: 'Invalid token',
        message: 'Continuation token is invalid or expired',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Determine token format (Phase 1 or Phase 2)
  let daily: DailyExport | null
  let currentIndex: number
  let isPhase2 = false

  if (isPhase1Token(token)) {
    // Phase 1: Use date and currentIndex directly
    const { date, currentIndex: idx } = token
    currentIndex = idx

    // Get question set for Phase 1
    daily = await fetchDailyQuestions(env, date)
    if (!daily) {
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: `Question set for ${date} no longer available`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
  } else if (isPhase2Token(token)) {
    // Phase 2B: Use rid, idx from token
    const phase2Token = token as Phase2TokenPayload
    currentIndex = phase2Token.idx
    isPhase2 = true

    // Validate token exp
    const now = Math.floor(Date.now() / 1000)
    if (phase2Token.exp < now) {
      return new Response(
        JSON.stringify({
          error: 'Invalid token',
          message: 'Token has expired',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Get question set for Phase 2
    daily = await fetchRoundByToken(env, phase2Token)
    if (!daily) {
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: 'Round data not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
  } else {
    // Unknown token format
    return new Response(
      JSON.stringify({
        error: 'Invalid token format',
        message: 'Token format is not recognized',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Validate currentIndex
  if (currentIndex < 0 || currentIndex >= daily.questions.length) {
    return new Response(
      JSON.stringify({ error: 'Invalid state', message: 'Question index out of bounds' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const currentQuestion = daily.questions[currentIndex]

  // 4. Check answer
  const correctChoice = currentQuestion.choices.find((c) => c.correct)
  if (!correctChoice) {
    return new Response(
      JSON.stringify({ error: 'Internal error', message: 'Question has no correct answer' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const isCorrect = answer === correctChoice.id
  const nextIndex = currentIndex + 1
  const isFinished = nextIndex >= daily.questions.length

  // 5. Prepare response
  const response: {
    result: {
      correct: boolean
      correctAnswer: string
      reveal: typeof currentQuestion.reveal
    }
    question?: { id: string; title: string }
    choices?: { id: string; text: string }[]
    continuationToken?: string
    progress?: {
      index: number
      total: number
    }
    finished: boolean
  } = {
    result: {
      correct: isCorrect,
      correctAnswer: correctChoice.id,
      reveal: currentQuestion.reveal,
    },
    progress: {
      // Clamp index to [1, total]: when finished, show total (last question)
      index: Math.min(nextIndex + 1, daily.questions.length), // 1-based
      total: daily.questions.length,
    },
    finished: false,
  }

  // 6. Check if finished
  if (isFinished) {
    response.finished = true
  } else {
    const nextQuestion = daily.questions[nextIndex]
    response.question = {
      id: nextQuestion.id,
      title: 'この曲のゲームタイトルは?',
    }
    response.choices = nextQuestion.choices.map((c) => ({ id: c.id, text: c.text }))

    // 7. Generate next token based on type
    if (isPhase2) {
      // Phase 2B: Create JWS token
      const phase2Token = token as Phase2TokenPayload
      const newPayload: Parameters<typeof createJWSToken>[0] = {
        rid: phase2Token.rid,
        idx: nextIndex,
        total: phase2Token.total,
        seed: phase2Token.seed,
        filtersHash: phase2Token.filtersHash,
        ver: phase2Token.ver,
      }

      // Preserve optional aud and nbf fields for future use
      if (phase2Token.aud) {
        newPayload.aud = phase2Token.aud
      }
      if (phase2Token.nbf) {
        newPayload.nbf = phase2Token.nbf
      }

      response.continuationToken = await createJWSToken(newPayload, env.JWT_SECRET)
    } else {
      // Phase 1: Create Base64 token
      const phase1Token = token as Phase1TokenPayload | null
      if (phase1Token) {
        response.continuationToken = await createContinuationToken({
          date: phase1Token.date,
          currentIndex: nextIndex,
          totalQuestions: phase1Token.totalQuestions,
        })
      }
    }

    response.finished = false
  }

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

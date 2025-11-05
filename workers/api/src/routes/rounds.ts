import { getDefaultMode, isValidFacetValue, manifest } from '../../../shared/data/manifest'
import { getTodayJST } from '../../../shared/lib/date'
import { createFilterKey, hashFilterKey, normalizeFilters } from '../../../shared/lib/filters'
import type { Env } from '../../../shared/types/env'
import type { DailyExport } from '../../../shared/types/export'
import type { FilterOptions } from '../../../shared/types/filters'
import { fetchDailyQuestions, fetchRoundByToken, fetchRoundExport } from '../lib/daily'
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

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

interface StartRequestBody {
  mode?: string
  filters?: {
    difficulty?: string | string[]
    era?: string | string[]
    series?: string | string[]
  }
  total?: number
  seed?: string
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })
}

function errorResponse(status: number, code: string, message: string, pointer?: string): Response {
  return jsonResponse(status, {
    error: {
      code,
      message,
      ...(pointer ? { details: { pointer } } : {}),
    },
  })
}

function coerceStringArray(input: unknown): string[] | null {
  if (input === undefined) return []
  if (input === null) return []
  if (typeof input === 'string') return [input]
  if (Array.isArray(input) && input.every((value) => typeof value === 'string')) {
    return input as string[]
  }
  return null
}

function parseFilters(input: StartRequestBody['filters']): FilterOptions | Response {
  if (!input) {
    return {}
  }

  const filters: FilterOptions = {}

  const difficultyValues = coerceStringArray(input.difficulty)
  if (difficultyValues === null) {
    return errorResponse(
      400,
      'bad_request',
      'difficulty must be a string or string[]',
      '/filters/difficulty',
    )
  }
  // "mixed" is treated as an empty/no-filter request (i.e., all difficulties)
  const difficultyCandidates = difficultyValues.filter((value) => value && value !== 'mixed')
  if (difficultyCandidates.length > 1) {
    return errorResponse(
      400,
      'bad_request',
      'specify at most one difficulty value',
      '/filters/difficulty',
    )
  }
  if (difficultyCandidates.length === 1) {
    const candidate = difficultyCandidates[0]
    if (!isValidFacetValue('difficulty', candidate)) {
      return errorResponse(
        400,
        'bad_request',
        `unknown difficulty: ${candidate}`,
        '/filters/difficulty',
      )
    }
    filters.difficulty = candidate
  }

  const eraValues = coerceStringArray(input.era)
  if (eraValues === null) {
    return errorResponse(400, 'bad_request', 'era must be a string or string[]', '/filters/era')
  }
  // "mixed" is treated as an empty/no-filter request (i.e., all eras)
  const eraCandidates = eraValues.filter((value) => value && value !== 'mixed')
  if (eraCandidates.length > 1) {
    return errorResponse(400, 'bad_request', 'specify at most one era value', '/filters/era')
  }
  if (eraCandidates.length === 1) {
    const candidate = eraCandidates[0]
    if (!isValidFacetValue('era', candidate)) {
      return errorResponse(400, 'bad_request', `unknown era: ${candidate}`, '/filters/era')
    }
    filters.era = candidate
  }

  const seriesValues = coerceStringArray(input.series)
  if (seriesValues === null) {
    return errorResponse(
      400,
      'bad_request',
      'series must be a string or string[]',
      '/filters/series',
    )
  }
  const seriesCandidates = seriesValues
    .filter((value) => value && value !== 'mixed')
    .filter((value, index, arr) => arr.indexOf(value) === index)

  if (seriesCandidates.length > 0) {
    const invalid = seriesCandidates.find((value) => !isValidFacetValue('series', value))
    if (invalid) {
      return errorResponse(400, 'bad_request', `unknown series: ${invalid}`, '/filters/series')
    }
    filters.series = seriesCandidates
  }

  return filters
}

function resolveMode(modeId?: string) {
  if (!modeId) {
    return getDefaultMode()
  }
  return manifest.modes.find((mode) => mode.id === modeId)
}

/**
 * POST /v1/rounds/start - Start a new round with optional filters
 */
export async function handleRoundsStart(request: Request, env: Env): Promise<Response> {
  let body: StartRequestBody
  try {
    body = (await request.json()) as StartRequestBody
  } catch (error) {
    console.error('[RoundsStart] Failed to parse JSON body', error)
    return errorResponse(400, 'bad_request', 'request body must be valid JSON')
  }

  const mode = resolveMode(body.mode)
  if (!mode) {
    return errorResponse(404, 'not_found', `mode ${body.mode} not found`, '/mode')
  }

  const filtersOrError = parseFilters(body.filters)
  if (filtersOrError instanceof Response) {
    return filtersOrError
  }

  const normalizedFilters = normalizeFilters(filtersOrError)
  const filterKey = createFilterKey(normalizedFilters)
  const requestedTotal = body.total ?? mode.defaultTotal

  if (!Number.isInteger(requestedTotal) || requestedTotal <= 0) {
    return errorResponse(400, 'bad_request', 'total must be a positive integer', '/total')
  }

  const date = getTodayJST()
  const exportData = await fetchRoundExport(env, date, filterKey)

  if (!exportData || exportData.questions.length === 0) {
    return errorResponse(503, 'no_questions', 'No questions available for the requested filters')
  }

  const availableTotal = exportData.questions.length
  if (requestedTotal > availableTotal) {
    return errorResponse(
      422,
      'insufficient_inventory',
      `Requested total ${requestedTotal} exceeds available inventory (${availableTotal})`,
      '/total',
    )
  }

  const effectiveTotal = Math.min(requestedTotal, availableTotal)

  const firstQuestion = exportData.questions[0]
  if (!firstQuestion) {
    return errorResponse(503, 'no_questions', 'No questions available for the requested filters')
  }

  const roundId = generateUUID()
  const seed =
    typeof body.seed === 'string' && body.seed.length > 0
      ? body.seed
      : generateUUID().replace(/-/g, '').substring(0, 16)
  const filtersHash = hashFilterKey(filterKey)

  const token = await createJWSToken(
    {
      rid: roundId,
      idx: 0,
      total: effectiveTotal,
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

  const choices = firstQuestion.choices.map((choice) => ({ id: choice.id, text: choice.text }))

  return jsonResponse(200, {
    round: {
      id: roundId,
      mode: mode.id,
      date,
      filters: normalizedFilters,
      progress: {
        index: 1,
        total: effectiveTotal,
      },
      token,
    },
    question: {
      id: firstQuestion.id,
      title: 'この曲のゲームタイトルは?',
    },
    choices,
    continuationToken: token,
    progress: {
      index: 1,
      total: effectiveTotal,
    },
  })
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
  let phase2Token: Phase2TokenPayload | null = null

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
    phase2Token = token as Phase2TokenPayload
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
  const totalQuestions =
    isPhase2 && phase2Token
      ? Math.min(phase2Token.total, daily.questions.length)
      : daily.questions.length

  if (currentIndex < 0 || currentIndex >= totalQuestions) {
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
  const isFinished = nextIndex >= totalQuestions

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
      index: Math.min(nextIndex + 1, totalQuestions), // 1-based
      total: totalQuestions,
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
      const currentPhase2Token = phase2Token as Phase2TokenPayload
      const newPayload: Parameters<typeof createJWSToken>[0] = {
        rid: currentPhase2Token.rid,
        idx: nextIndex,
        total: currentPhase2Token.total,
        seed: currentPhase2Token.seed,
        filtersHash: currentPhase2Token.filtersHash,
        filtersKey: currentPhase2Token.filtersKey,
        ver: currentPhase2Token.ver,
      }

      // Preserve optional aud and nbf fields for future use
      if (currentPhase2Token.aud) {
        newPayload.aud = currentPhase2Token.aud
      }
      if (currentPhase2Token.nbf) {
        newPayload.nbf = currentPhase2Token.nbf
      }
      if (currentPhase2Token.mode) {
        newPayload.mode = currentPhase2Token.mode
      }
      if (currentPhase2Token.date) {
        newPayload.date = currentPhase2Token.date
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

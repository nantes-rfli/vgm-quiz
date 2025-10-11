import { getTodayJST } from '../../../shared/lib/date'
import type { Env } from '../../../shared/types/env'
import { fetchDailyQuestions } from '../lib/daily'
import { createContinuationToken, decodeContinuationToken } from '../lib/token'

/**
 * GET /v1/rounds/start - Start a new round
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

  // Create continuation token
  const token = await createContinuationToken({
    date,
    currentIndex: 0,
    totalQuestions: daily.questions.length,
  })

  return new Response(
    JSON.stringify({
      question: {
        id: firstQuestion.id,
        title: 'この曲のゲームタイトルは?',
      },
      choices: firstQuestion.choices.map((c) => ({ id: c.id, text: c.text })),
      continuationToken: token,
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

  // 1. Decode token
  const token = await decodeContinuationToken(continuationToken)
  if (!token) {
    return new Response(
      JSON.stringify({
        error: 'Invalid token',
        message: 'Continuation token is invalid or expired',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { date, currentIndex } = token

  // 2. Get question set
  const daily = await fetchDailyQuestions(env, date)
  if (!daily) {
    return new Response(
      JSON.stringify({
        error: 'Not found',
        message: `Question set for ${date} no longer available`,
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
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
    finished: boolean
  } = {
    result: {
      correct: isCorrect,
      correctAnswer: correctChoice.id,
      reveal: currentQuestion.reveal,
    },
    finished: false,
  }

  // 6. Check if finished
  const nextIndex = currentIndex + 1
  if (nextIndex >= daily.questions.length) {
    response.finished = true
  } else {
    const nextQuestion = daily.questions[nextIndex]
    response.question = {
      id: nextQuestion.id,
      title: 'この曲のゲームタイトルは?',
    }
    response.choices = nextQuestion.choices.map((c) => ({ id: c.id, text: c.text }))
    response.continuationToken = await createContinuationToken({
      date,
      currentIndex: nextIndex,
      totalQuestions: daily.questions.length,
    })
    response.finished = false
  }

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

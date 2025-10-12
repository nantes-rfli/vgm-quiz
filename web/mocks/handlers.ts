// Clean MSW handlers for Phase 1 backend with Base64 tokens
import { http, HttpResponse } from 'msw';
import { TOTAL as ROUND_TOTAL, getQuestionByIndex } from './fixtures/rounds/index';
import { ANSWERS } from './fixtures/rounds/answers';
import { META } from './fixtures/rounds/meta';
import { encodeBase64url, decodeBase64url, type Phase1Token } from '@/src/lib/base64url';

const enc = encodeBase64url;
const dec = decodeBase64url;

export const handlers = [
  // Phase 1: GET /v1/rounds/start
  http.get('/v1/rounds/start', async () => {
    const total = ROUND_TOTAL;
    const token: Phase1Token = {
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      currentIndex: 0,
      totalQuestions: total,
    };

    // Get first question
    const firstQuestion = getQuestionByIndex(1);
    if (!firstQuestion) {
      return new HttpResponse('No questions available', { status: 503 });
    }

    return HttpResponse.json({
      question: {
        id: firstQuestion.id,
        title: firstQuestion.prompt, // Phase 1 uses 'title' not 'prompt'
      },
      choices: firstQuestion.choices.map((c) => ({
        id: c.id,
        text: c.label, // Phase 1 uses 'text' not 'label'
      })),
      continuationToken: enc(token),
    });
  }),

  // Phase 1: POST /v1/rounds/next
  http.post('/v1/rounds/next', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      continuationToken?: string;
      answer?: string;
    };

    const { continuationToken, answer } = body;
    if (!continuationToken) {
      return new HttpResponse('Missing continuationToken', { status: 400 });
    }

    let token: Phase1Token;
    try {
      token = dec(continuationToken) as Phase1Token;
    } catch {
      return new HttpResponse('Invalid continuationToken', { status: 400 });
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
        finished: true,
      });
    }

    // Get next question
    const nextQuestion = getQuestionByIndex(nextIndex + 1);
    if (!nextQuestion) {
      return new HttpResponse('Next question not found', { status: 500 });
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
      continuationToken: enc({
        date: token.date,
        currentIndex: nextIndex,
        totalQuestions: token.totalQuestions,
      }),
      finished: false,
    });
  }),

  http.post('/v1/metrics', async () => new HttpResponse(null, { status: 202 })),
];

export default handlers;
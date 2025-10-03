'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ErrorBanner from '@/src/components/ErrorBanner';
import Progress from '@/src/components/Progress';
import QuestionCard from '@/src/components/QuestionCard';
import RevealCard from '@/src/components/RevealCard';
import ScoreBadge from '@/src/components/ScoreBadge';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import Timer from '@/src/components/Timer';
import {
  saveResult,
  appendReveal,
  clearReveals,
  type ResultSummary,
  type QuestionRecord,
  type ScoreBreakdown,
  type Outcome,
} from '@/src/lib/resultStorage';
import { msToSeconds } from '@/src/lib/timeUtils';
import type { Question, RoundsStartResponse, RoundsNextResponse, Reveal } from '@/src/features/quiz/api/types';
import { start, next } from '@/src/features/quiz/datasource';
import { waitMockReady } from '@/src/lib/waitMockReady';
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient';
import { enrichReveal, toQuestionRecord } from '@/src/features/quiz/lib/reveal';
import { mark, measure } from '@/src/lib/perfMarks';

/**
 * Play page with reveal phase (FE-04 Sub DoD) — refactored with useReducer
 * - Centralized state transitions via reducer
 * - Clear "phase" handling and queued-next pipeline
 * - Safer effects/dispatching and unmount guards
 * - Smaller, testable helpers
 */

type ProgressInfo = { index: number; total: number };

const QUESTION_TIME_LIMIT_MS = 15_000;
const TIMEOUT_CHOICE_ID = '__timeout__';
const SKIP_CHOICE_ID = '__skip__';

type State = {
  token?: string;
  question?: Question;
  progress?: ProgressInfo;
  loading: boolean;
  error?: string;
  selectedId?: string;
  beganAt?: number; // ms timestamp for current question
  startedAt?: string; // ISO string for run start
  started: boolean;
  phase: 'question' | 'reveal';
  queuedNext?: RoundsNextResponse;
  currentReveal?: Reveal;
  deadline?: number;
  remainingMs: number;
  tally: ScoreBreakdown;
  history: QuestionRecord[];
};

const AUTO_START = process.env.NEXT_PUBLIC_PLAY_AUTOSTART !== '0';
const IS_MOCK = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_MOCK === '1';

// ————————————————————————————————————————————————————————
// Reducer
// ————————————————————————————————————————————————————————

type Action =
  | { type: 'BOOTING' }
  | {
      type: 'STARTED';
      payload: {
        token: string;
        question?: Question;
        progress?: ProgressInfo;
        beganAt: number;
        startedAt: string;
        currentReveal?: Reveal;
      };
    }
  | { type: 'ERROR'; error: string }
  | { type: 'SELECT'; id: string }
  | { type: 'ENTER_REVEAL'; reveal?: Reveal }
  | { type: 'QUEUE_NEXT'; next: RoundsNextResponse; reveal?: Reveal }
  | { type: 'ADVANCE'; next: RoundsNextResponse }
  | { type: 'TICK'; remainingMs: number }
  | { type: 'APPLY_RESULT'; payload: { tally: ScoreBreakdown; history: QuestionRecord[] } };

const EMPTY_TALLY: ScoreBreakdown = { correct: 0, wrong: 0, timeout: 0, skip: 0, points: 0 };

const initialState: State = {
  loading: AUTO_START,
  started: AUTO_START,
  phase: 'question',
  remainingMs: QUESTION_TIME_LIMIT_MS,
  tally: { ...EMPTY_TALLY },
  history: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'BOOTING':
      return { ...state, loading: true, error: undefined, started: true };

    case 'STARTED': {
      const { token, question, progress, beganAt, startedAt, currentReveal } = action.payload;
      return {
        token,
        question,
        progress,
        loading: false,
        error: undefined,
        selectedId: undefined,
        beganAt,
        startedAt,
        started: true,
        phase: 'question',
        queuedNext: undefined,
        currentReveal,
        deadline: beganAt + QUESTION_TIME_LIMIT_MS,
        remainingMs: QUESTION_TIME_LIMIT_MS,
        tally: { ...EMPTY_TALLY },
        history: [],
      };
    }

    case 'ERROR':
      return { ...state, loading: false, error: action.error };

    case 'SELECT':
      return { ...state, selectedId: action.id };

    case 'ENTER_REVEAL':
      return { ...state, phase: 'reveal', loading: false, error: undefined, currentReveal: action.reveal };

    case 'QUEUE_NEXT': {
      return { ...state, queuedNext: action.next, currentReveal: action.reveal ?? state.currentReveal };
    }

    case 'ADVANCE': {
      const qn = action.next;
      // NOTE: caller must handle finished-case navigation before dispatching ADVANCE
      const nextProgress: ProgressInfo | undefined =
        qn.round?.progress ?? (state.progress ? { index: state.progress.index + 1, total: state.progress.total } : undefined);
      return {
        ...state,
        loading: false,
        error: undefined,
        token: qn.round?.token ?? state.token,
        question: qn.question!,
        progress: nextProgress,
        selectedId: undefined,
        beganAt: performance.now(),
        phase: 'question',
        queuedNext: undefined,
        currentReveal: undefined,
        deadline: performance.now() + QUESTION_TIME_LIMIT_MS,
        remainingMs: QUESTION_TIME_LIMIT_MS,
      };
    }

    case 'TICK':
      return { ...state, remainingMs: Math.max(0, Math.round(action.remainingMs)) };

    case 'APPLY_RESULT':
      return { ...state, tally: action.payload.tally, history: action.payload.history };

    default:
      return state;
  }
}

// ————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————

function computePoints(remainingMs: number): number {
  return 100 + msToSeconds(remainingMs) * 5;
}

function rollupTally(prev: ScoreBreakdown, outcome: Outcome, pointsDelta: number): ScoreBreakdown {
  return {
    correct: prev.correct + (outcome === 'correct' ? 1 : 0),
    wrong: prev.wrong + (outcome === 'wrong' ? 1 : 0),
    timeout: prev.timeout + (outcome === 'timeout' ? 1 : 0),
    skip: prev.skip + (outcome === 'skip' ? 1 : 0),
    points: prev.points + pointsDelta,
  };
}

function composeSummary(input: {
  tally: ScoreBreakdown;
  history: QuestionRecord[];
  total: number;
  startedAt?: string;
  finishedAt: string;
}): ResultSummary {
  return {
    answeredCount: input.history.length,
    total: input.total,
    score: input.tally,
    questions: input.history,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
  };
}

// ————————————————————————————————————————————————————————
// Component
// ————————————————————————————————————————————————————————

export default function PlayPage() {
  const router = useRouter();

  const isMountedRef = React.useRef(true);
  React.useEffect(() => () => { isMountedRef.current = false; }, []);

  const [s, dispatch] = React.useReducer(reducer, initialState);
  const {
    phase,
    token,
    question,
    selectedId,
    currentReveal,
    progress,
    startedAt,
    beganAt,
    queuedNext,
    deadline,
    remainingMs,
    tally,
    history,
    loading,
  } = s;

  const safeDispatch = React.useCallback((a: Action) => {
    if (isMountedRef.current) dispatch(a);
  }, []);

  const latestRecord = history.length > 0 ? history[history.length - 1] : undefined;

  const bootAndStart = React.useCallback(async () => {
    try {
      await waitMockReady({ timeoutMs: 2000 });
      mark('quiz:bootstrap-ready');

      let res: RoundsStartResponse | undefined;
      try {
        res = await start();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (IS_MOCK && /404/.test(message)) {
          // mock server cold-start shim
          await new Promise((r) => setTimeout(r, 180));
          res = await start();
        } else {
          throw e;
        }
      }

      if (!isMountedRef.current) return;

      if (!res) {
        safeDispatch({ type: 'ERROR', error: 'Empty response from /v1/rounds/start' });
        return;
      }

      try { clearReveals(); } catch {}

      safeDispatch({
        type: 'STARTED',
        payload: {
          token: res.round.token,
          question: res.question,
          progress: res.round.progress,
          beganAt: performance.now(),
          startedAt: new Date().toISOString(),
          currentReveal: res.question?.reveal,
        },
      });
      mark('quiz:first-question-visible', { questionId: res.question?.id });
      measure('quiz:navigation-to-first-question', 'navigationStart', 'quiz:first-question-visible');
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      safeDispatch({ type: 'ERROR', error: message || 'Failed to start.' });
    }
  }, [safeDispatch]);

  // bootstrap (autostart mode)
  React.useEffect(() => {
    if (!AUTO_START) return;
    void bootAndStart();
  }, [bootAndStart]);

  const onClickStart = React.useCallback(async () => {
    safeDispatch({ type: 'BOOTING' });
    await bootAndStart();
  }, [bootAndStart, safeDispatch]);

  const onSelectChoice = React.useCallback(
    (id: string) => {
      if (!question) {
        safeDispatch({ type: 'SELECT', id });
        return;
      }

      const choice = question.choices.find((c) => c.id === id);
      recordMetricsEvent('answer_select', {
        roundId: token,
        questionIdx: progress?.index,
        attrs: {
          questionId: question.id,
          choiceId: id,
          choiceLabel: choice?.label,
        },
      });
      safeDispatch({ type: 'SELECT', id });
    },
    [question, token, progress?.index, safeDispatch]
  );

  const processAnswer = React.useCallback(
    async (mode: { kind: 'answer' | 'timeout' | 'skip'; choiceId?: string }) => {
      if (phase === 'reveal' || !token || !question) return;
      if (mode.kind === 'answer' && !mode.choiceId) return;

      const remainingForCalc = Math.max(0, remainingMs);
      const elapsedMs = beganAt ? Math.round(performance.now() - beganAt) : undefined;

      // Switch to reveal phase immediately (freeze UI) and show current reveal
      safeDispatch({ type: 'ENTER_REVEAL', reveal: question.reveal });
      mark('quiz:reveal-visible', { questionId: question.id });

      const effectiveChoiceId =
        mode.kind === 'answer'
          ? mode.choiceId!
          : mode.kind === 'timeout'
            ? TIMEOUT_CHOICE_ID
            : SKIP_CHOICE_ID;

      try {
        const res: RoundsNextResponse = await next({ token, answer: { questionId: question.id, choiceId: effectiveChoiceId } });

        const enriched = enrichReveal(currentReveal, res.reveal, question.reveal);
        try { if (enriched) appendReveal(enriched); } catch {}

        const outcome: Outcome =
          mode.kind === 'timeout'
            ? 'timeout'
            : mode.kind === 'skip'
              ? 'skip'
              : enriched?.correct === true
                ? 'correct'
                : 'wrong';

        const points = outcome === 'correct' ? computePoints(remainingForCalc) : 0;
        const questionRecord = toQuestionRecord({
          question,
          reveal: enriched,
          outcome,
          remainingMs: remainingForCalc,
          choiceId: mode.kind === 'answer' ? mode.choiceId : undefined,
          points,
        });

        const updatedHistory = [...history, questionRecord];
        const updatedTally = rollupTally(tally, outcome, points);

        recordMetricsEvent('answer_result', {
          roundId: token,
          questionIdx: progress?.index,
          attrs: {
            questionId: question.id,
            outcome,
            points,
            remainingSeconds: Math.floor(remainingForCalc / 1000),
            choiceId: questionRecord.choiceId,
            correctChoiceId: questionRecord.correctChoiceId,
            elapsedMs,
          },
        });

        safeDispatch({ type: 'APPLY_RESULT', payload: { tally: updatedTally, history: updatedHistory } });

        if (res.finished === true) {
          const finishedAt = new Date().toISOString();
          const totalQuestions = progress?.total ?? updatedHistory.length;
          const durationMs = startedAt ? Date.parse(finishedAt) - Date.parse(startedAt) : undefined;
          saveResult(
            composeSummary({
              tally: updatedTally,
              history: updatedHistory,
              total: totalQuestions,
              startedAt,
              finishedAt,
            })
          );

          recordMetricsEvent('quiz_complete', {
            roundId: token,
            attrs: {
              total: totalQuestions,
              points: updatedTally.points,
              correct: updatedTally.correct,
              wrong: updatedTally.wrong,
              timeout: updatedTally.timeout,
              skip: updatedTally.skip,
              durationMs,
            },
          });
        }

        safeDispatch({ type: 'QUEUE_NEXT', next: res, reveal: enriched });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        safeDispatch({ type: 'ERROR', error: message || 'Failed to load next.' });
      }
    },
    [phase, token, question, remainingMs, safeDispatch, beganAt, currentReveal, history, tally, progress?.total, progress?.index, startedAt]
  );

  const submitAnswer = React.useCallback(async () => {
    if (phase === 'reveal' || !selectedId) return;
    await processAnswer({ kind: 'answer', choiceId: selectedId });
  }, [phase, selectedId, processAnswer]);

  const onNextFromReveal = React.useCallback(() => {
    const qn = queuedNext;
    if (!qn) return;
    if (qn.finished === true) {
      // End of round
      mark('quiz:play-finished', { totalQuestions: progress?.total });
      measure('quiz:first-question-to-finish', 'quiz:first-question-visible', 'quiz:play-finished');
      router.push('/result');
      return;
    }
    safeDispatch({ type: 'ADVANCE', next: qn });
  }, [queuedNext, router, safeDispatch, progress]);

  React.useEffect(() => {
    if (phase !== 'question' || !deadline) return;
    const id = window.setInterval(() => {
      const remaining = deadline - performance.now();
      safeDispatch({ type: 'TICK', remainingMs: remaining });
      if (remaining <= 0) {
        window.clearInterval(id);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, deadline, safeDispatch]);

  const timeoutTriggeredRef = React.useRef(false);
  React.useEffect(() => {
    timeoutTriggeredRef.current = false;
  }, [question?.id]);

  React.useEffect(() => {
    if (phase !== 'question' || !question) return;
    if (remainingMs > 0) return;
    if (timeoutTriggeredRef.current) return;
    timeoutTriggeredRef.current = true;
    void processAnswer({ kind: 'timeout' });
  }, [phase, question, remainingMs, processAnswer]);

  // Keyboard controls
  React.useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      // During reveal phase: only Enter=Next
      if (phase === 'reveal') {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          onNextFromReveal();
        }
        return;
      }

      if (loading || !question) return;

      if (/^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const c = question.choices[idx];
        if (c) {
          ev.preventDefault();
          safeDispatch({ type: 'SELECT', id: c.id });
        }
        return;
      }

      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const { choices } = question;
        if (!choices.length) return;
        const curIdx = choices.findIndex((c) => c.id === selectedId);
        const dir = ev.key === 'ArrowUp' ? -1 : 1;
        const nextIdx = ((curIdx >= 0 ? curIdx : -1) + dir + choices.length) % choices.length;
        safeDispatch({ type: 'SELECT', id: choices[nextIdx].id });
        return;
      }

      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (selectedId) void submitAnswer();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, loading, question, selectedId, submitAnswer, onNextFromReveal, safeDispatch]);

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <ScoreBadge
            correct={tally.correct}
            wrong={tally.wrong}
            timeout={tally.timeout}
            skip={tally.skip}
            points={tally.points}
            total={progress?.total}
          />
          <InlinePlaybackToggle />
        </div>

        {!s.started ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <h1 className="text-2xl font-semibold mb-4">Ready?</h1>
            {s.error ? <div className="mb-3 text-red-700">{s.error}</div> : null}
            <button type="button" onClick={onClickStart} className="px-4 py-2 rounded-xl bg-black text-white">
              Start
            </button>
          </div>
        ) : (
          <>
            <Progress index={s.progress?.index} total={s.progress?.total} />
            {phase === 'question' ? <Timer remainingMs={remainingMs} totalMs={QUESTION_TIME_LIMIT_MS} /> : null}
            {s.error ? <ErrorBanner message={s.error} /> : null}

            {s.phase === 'reveal' ? (
              <div>
              <RevealCard
                reveal={s.currentReveal}
                result={
                  latestRecord
                    ? {
                          outcome: latestRecord.outcome,
                          points: latestRecord.points,
                          remainingMs: latestRecord.remainingMs,
                          choiceLabel: latestRecord.choiceLabel,
                          correctLabel: latestRecord.correctLabel,
                        }
                      : undefined
                }
                telemetry={{
                  roundId: token,
                  questionIdx: progress?.index,
                  questionId: latestRecord?.questionId ?? question?.id,
                }}
              />
                <div className="mt-4 text-right">
                  <button
                    type="button"
                    onClick={onNextFromReveal}
                    data-testid="reveal-next"
                    className="px-4 py-2 rounded-xl bg-black text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : !s.question && s.loading ? (
              <div className="text-gray-600">Loading...</div>
            ) : s.question ? (
              <QuestionCard
                prompt={s.question.prompt}
                choices={s.question.choices}
                selectedId={s.selectedId}
                disabled={s.loading}
                onSelect={onSelectChoice}
                onSubmit={submitAnswer}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

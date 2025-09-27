'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ErrorBanner from '@/src/components/ErrorBanner';
import Progress from '@/src/components/Progress';
import QuestionCard from '@/src/components/QuestionCard';
import RevealCard from '@/src/components/RevealCard';
import ScoreBadge from '@/src/components/ScoreBadge';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import { saveResult, appendReveal, clearReveals } from '@/src/lib/resultStorage';
import type {
  Question,
  RoundsStartResponse,
  RoundsNextResponse,
  MetricsRequest,
  Reveal,
} from '@/src/features/quiz/api/types';
import { start, next, sendMetrics } from '@/src/features/quiz/datasource';
import { waitMockReady } from '@/src/lib/waitMockReady';

/**
 * Play page with reveal phase (FE-04 Sub DoD) — refactored with useReducer
 * - Centralized state transitions via reducer
 * - Clear "phase" handling and queued-next pipeline
 * - Safer effects/dispatching and unmount guards
 * - Smaller, testable helpers
 */

type ProgressInfo = { index: number; total: number };

type State = {
  token?: string;
  question?: Question;
  progress?: ProgressInfo;
  loading: boolean;
  error?: string;
  selectedId?: string;
  beganAt?: number; // ms timestamp for current question
  startedAt?: string; // ISO string for run start
  answeredCount: number;
  started: boolean;
  phase: 'question' | 'reveal';
  queuedNext?: RoundsNextResponse;
  currentReveal?: Reveal;
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
  | { type: 'ADVANCE'; next: RoundsNextResponse };

const initialState: State = {
  loading: AUTO_START,
  answeredCount: 0,
  started: AUTO_START,
  phase: 'question',
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
        answeredCount: 0,
        started: true,
        phase: 'question',
        queuedNext: undefined,
        currentReveal,
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
        answeredCount: state.answeredCount + 1,
        phase: 'question',
        queuedNext: undefined,
        currentReveal: undefined,
      };
    }

    default:
      return state;
  }
}

// ————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————

function enrichReveal(prev: Reveal | undefined, fromNext?: Reveal, fromQuestion?: Reveal): Reveal | undefined {
  const fallback = prev ?? fromQuestion;
  if (!fromNext) return fallback;
  if (!fallback) return fromNext;

  return {
    ...fallback,
    ...fromNext,
    links: fromNext.links && fromNext.links.length > 0 ? fromNext.links : fallback.links,
    meta: fromNext.meta ?? fallback.meta,
  };
}

type MetricsInput = Pick<State, 'token' | 'question' | 'selectedId' | 'beganAt'>;

function buildMetricsPayload(input: MetricsInput): MetricsRequest | undefined {
  const { token, question, selectedId, beganAt } = input;
  if (!token || !question || !selectedId) return undefined;
  return {
    token,
    questionId: question.id,
    choiceId: selectedId,
    answeredAt: new Date().toISOString(),
    latencyMs: beganAt ? Math.round(performance.now() - beganAt) : undefined,
    extras: { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined },
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
    answeredCount,
    progress,
    startedAt,
    beganAt,
    queuedNext,
  } = s;

  const safeDispatch = React.useCallback((a: Action) => {
    if (isMountedRef.current) dispatch(a);
  }, []);

  const bootAndStart = React.useCallback(async () => {
    try {
      await waitMockReady({ timeoutMs: 2000 });

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

  const submitAnswer = React.useCallback(async () => {
    if (phase === 'reveal' || !token || !question || !selectedId) return;

    // Switch to reveal phase immediately (freeze UI) and show current reveal
    safeDispatch({ type: 'ENTER_REVEAL', reveal: question.reveal });

    // Metrics (fire-and-forget)
    const payload = buildMetricsPayload({ token, question, selectedId, beganAt });
    if (payload) sendMetrics(payload);

    // Preload next in background
    try {
      const res: RoundsNextResponse = await next({ token, answer: { questionId: question.id, choiceId: selectedId } });

      const enriched = enrichReveal(currentReveal, res.reveal, question.reveal);
      try { if (enriched) appendReveal(enriched); } catch {}

      if (res.finished === true) {
        // Persist summary immediately
        try {
          const answeredCountNext = answeredCount + 1;
          const summary = {
            answeredCount: answeredCountNext,
            total: progress?.total ?? answeredCountNext,
            startedAt,
            finishedAt: new Date().toISOString(),
          };
          saveResult(summary);
        } catch { /* ignore */ }

        safeDispatch({ type: 'QUEUE_NEXT', next: res, reveal: enriched });
        return;
      }

      safeDispatch({ type: 'QUEUE_NEXT', next: res, reveal: enriched });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      safeDispatch({ type: 'ERROR', error: message || 'Failed to load next.' });
    }
  }, [phase, token, question, selectedId, currentReveal, answeredCount, progress?.total, startedAt, beganAt, safeDispatch]);

  const onNextFromReveal = React.useCallback(() => {
    const qn = queuedNext;
    if (!qn) return;
    if (qn.finished === true) {
      // End of round
      router.push('/result');
      return;
    }
    safeDispatch({ type: 'ADVANCE', next: qn });
  }, [queuedNext, router, safeDispatch]);

  // Keyboard controls
  React.useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      // During reveal phase: only Enter=Next
      if (s.phase === 'reveal') {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          onNextFromReveal();
        }
        return;
      }

      if (s.loading || !s.question) return;

      if (/^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const c = s.question.choices[idx];
        if (c) {
          ev.preventDefault();
          safeDispatch({ type: 'SELECT', id: c.id });
        }
        return;
      }

      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const { choices } = s.question;
        if (!choices.length) return;
        const curIdx = choices.findIndex((c) => c.id === s.selectedId);
        const dir = ev.key === 'ArrowUp' ? -1 : 1;
        const nextIdx = ((curIdx >= 0 ? curIdx : -1) + dir + choices.length) % choices.length;
        safeDispatch({ type: 'SELECT', id: choices[nextIdx].id });
        return;
      }

      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (s.selectedId) void submitAnswer();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [s.phase, s.loading, s.question, s.selectedId, submitAnswer, onNextFromReveal, safeDispatch]);

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <ScoreBadge correct={0} wrong={0} unknown={s.answeredCount} total={s.progress?.total} />
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
            {s.error ? <ErrorBanner message={s.error} /> : null}

            {s.phase === 'reveal' ? (
              <div>
                <RevealCard reveal={s.currentReveal} />
                <div className="mt-4 text-right">
                  <button type="button" onClick={onNextFromReveal} className="px-4 py-2 rounded-xl bg-black text-white">
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
                onSelect={(id) => safeDispatch({ type: 'SELECT', id })}
                onSubmit={submitAnswer}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

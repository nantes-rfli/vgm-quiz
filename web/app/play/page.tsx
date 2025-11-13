'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ErrorBanner from '@/src/components/ErrorBanner';
import Progress from '@/src/components/Progress';
import QuestionCard from '@/src/components/QuestionCard';
import RevealCard from '@/src/components/RevealCard';
import ScoreBadge from '@/src/components/ScoreBadge';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import Timer from '@/src/components/Timer';
import Toast from '@/src/components/Toast';
import FilterSelector from '@/src/components/FilterSelector';
import {
  clearReveals,
} from '@/src/lib/resultStorage';
import { saveAppliedFilters } from '@/src/lib/appliedFiltersStorage';
import { useI18n } from '@/src/lib/i18n';
import { FilterProvider } from '@/src/lib/filter-context';
import type { Phase1StartResponse } from '@/src/features/quiz/api/types';
import type { ApiError } from '@/src/features/quiz/api/errors';
import { ensureApiError, mapApiErrorToMessage } from '@/src/features/quiz/api/errors';
import { start } from '@/src/features/quiz/datasource';
import type { RoundStartRequest } from '@/src/features/quiz/api/manifest';
import { waitMockReady } from '@/src/lib/waitMockReady';
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient';
import { mark, measure } from '@/src/lib/perfMarks';
import {
  playReducer,
  createInitialState,
  QUESTION_TIME_LIMIT_MS,
  type PlayAction,
} from '@/src/features/quiz/playReducer';
import { useAnswerProcessor } from '@/src/features/quiz/useAnswerProcessor';

/**
 * Play page with reveal phase (FE-04 Sub DoD) — refactored with useReducer
 * - Centralized state transitions via reducer
 * - Clear "phase" handling and queued-next pipeline
 * - Safer effects/dispatching and unmount guards
 * - Smaller, testable helpers
 */

type ToastState = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  variant: 'info' | 'error';
  duration: number;
};

const AUTO_START = process.env.NEXT_PUBLIC_PLAY_AUTOSTART !== '0';
const IS_MOCK = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_MOCK === '1';

function PlayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  // Compute shouldAutoStart directly from query params (no state needed)
  // This avoids race conditions with state updates
  const queryAutoStartValue = React.useMemo(() => {
    try {
      const queryAutoStart = searchParams?.get('autostart');
      if (queryAutoStart === '0') return false;
      if (queryAutoStart === '1') return true;
    } catch {
      // Ignore errors reading query params
    }
    return AUTO_START; // Default to env var
  }, [searchParams]);

  const isMountedRef = React.useRef(true);
  React.useEffect(() => () => { isMountedRef.current = false; }, []);

  const [toast, setToast] = React.useState<ToastState | null>(null);
  const pendingRetryRef = React.useRef<(() => void) | null>(null);

  const showToast = React.useCallback(
    (
      message: string,
      options?: { actionLabel?: string; onAction?: () => void; variant?: 'info' | 'error'; duration?: number }
    ) => {
      setToast({
        id: Date.now(),
        message,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        variant: options?.variant ?? 'error',
        duration: options?.duration ?? 5000,
      });
    },
    []
  );

  const closeToast = React.useCallback(() => {
    setToast(null);
  }, []);

  const scheduleRetry = React.useCallback(
    (error: ApiError, retryFn: () => void) => {
      let message = mapApiErrorToMessage(error);
      // Handle specific error codes with i18n
      if (error.code === 'no_questions') {
        message = t('error.noQuestions');
      }
      const wrappedRetry = () => {
        pendingRetryRef.current = null;
        retryFn();
      };
      showToast(message, {
        actionLabel: t('toast.retry'),
        onAction: wrappedRetry,
        variant: 'error',
      });
      if (error.kind === 'offline') {
        pendingRetryRef.current = wrappedRetry;
      }
    },
    [showToast, t]
  );

  React.useEffect(() => {
    function handleOnline() {
      if (pendingRetryRef.current) {
        const retry = pendingRetryRef.current;
        pendingRetryRef.current = null;
        closeToast();
        retry();
      }
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [closeToast]);

  // Always initialize with started: false, let bootstrap effect control when to start
  // This avoids race conditions with query params that might not be available on first render
  const [s, dispatch] = React.useReducer(playReducer, createInitialState(false));
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

  const safeDispatch = React.useCallback((a: PlayAction) => {
    if (isMountedRef.current) dispatch(a);
  }, []);

  const latestRecord = history.length > 0 ? history[history.length - 1] : undefined;

  const bootAndStart = React.useCallback(
    async (params?: Partial<RoundStartRequest>) => {
      try {
        await waitMockReady({ timeoutMs: 2000 });
        mark('quiz:bootstrap-ready');

        let res: Phase1StartResponse | undefined;
        try {
          res = await start(params);
        } catch (e: unknown) {
          const apiError = ensureApiError(e);
          if (IS_MOCK && apiError.status === 404) {
            // mock server cold-start shim
            await new Promise((r) => setTimeout(r, 180));
            res = await start(params);
          } else {
            throw apiError;
          }
        }

        // Save applied filters to sessionStorage for result page display
        if (params) {
          saveAppliedFilters(params);
        }

      if (!isMountedRef.current) return;

      if (!res) {
        safeDispatch({ type: 'ERROR', error: 'Empty response from /v1/rounds/start' });
        return;
      }

      try { clearReveals(); } catch {}

      // Phase 1: convert response to Question format
      const question = {
        id: res.question.id,
        prompt: res.question.title, // Phase1 uses 'title', we use 'prompt'
        choices: res.choices.map((c) => ({
          id: c.id,
          label: c.text, // Phase1 uses 'text', we use 'label'
        })),
      };

      // Get progress from API response (preferred) or fallback to hardcoded values
      // The token is treated as opaque and never decoded on the client
      const progress = res.progress || { index: 1, total: 10 }; // fallback if not provided by API

      safeDispatch({
        type: 'STARTED',
        payload: {
          token: res.continuationToken, // Phase 1: continuationToken stored as token
          question,
          progress,
          beganAt: performance.now(),
          startedAt: new Date().toISOString(),
          currentReveal: undefined, // Phase 1: no initial reveal
        },
      });
      mark('quiz:first-question-visible', { questionId: question.id });
      measure('quiz:navigation-to-first-question', 'navigationStart', 'quiz:first-question-visible');
      pendingRetryRef.current = null;
      closeToast();
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const apiError = ensureApiError(e);
      // Use language-agnostic message for ERROR action
      const errorMessage = mapApiErrorToMessage(apiError);
      safeDispatch({ type: 'ERROR', error: errorMessage });
      scheduleRetry(apiError, () => {
        safeDispatch({ type: 'BOOTING' });
        void bootAndStart(params);
      });
    }
    },
    [safeDispatch, closeToast, scheduleRetry],
  );

  // bootstrap (autostart mode)
  React.useEffect(() => {
    if (!queryAutoStartValue) return;
    void bootAndStart();
  }, [bootAndStart, queryAutoStartValue]);

  const onFilterStart = React.useCallback(
    (params: Partial<RoundStartRequest>) => {
      closeToast();
      safeDispatch({ type: 'BOOTING' });
      void bootAndStart(params);
    },
    [bootAndStart, closeToast, safeDispatch],
  );

  const onClickStart = React.useCallback(async () => {
    closeToast();
    safeDispatch({ type: 'BOOTING' });
    await bootAndStart();
  }, [bootAndStart, closeToast, safeDispatch]);

  const processAnswer = useAnswerProcessor({
    phase,
    continuationToken: token, // Phase 1: rename for clarity
    question,
    remainingMs,
    beganAt,
    currentReveal,
    history,
    tally,
    progress,
    startedAt,
    dispatch: safeDispatch,
    onError: scheduleRetry,
  });

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
    <>
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
            !queryAutoStartValue ? (
              <FilterSelector onStart={onFilterStart} disabled={s.loading} />
            ) : (
              <div className="bg-white rounded-2xl shadow p-6 text-center">
                <h1 className="text-2xl font-semibold mb-4">Ready?</h1>
                {s.error ? <div className="mb-3 text-red-700">{s.error}</div> : null}
                <button type="button" onClick={onClickStart} className="px-4 py-2 rounded-xl bg-black text-white">
                  Start
                </button>
              </div>
            )
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
                key={s.question.id}
                questionId={s.question.id}
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
      {toast ? (
        <Toast
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onClose={closeToast}
          duration={toast.duration}
          variant={toast.variant}
          closeLabel={t('toast.close')}
        />
      ) : null}
    </>
  );
}

export default function PlayPage() {
  return (
    <FilterProvider>
      <PlayPageContent />
    </FilterProvider>
  );
}

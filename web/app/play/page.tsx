// /play page with pre-save reveal (FE-05 one-point fix)
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ErrorBanner from '@/src/components/ErrorBanner';
import Progress from '@/src/components/Progress';
import QuestionCard from '@/src/components/QuestionCard';
import type { Question, RoundsStartResponse, RoundsNextResponse, MetricsRequest } from '@/src/features/quiz/api/types';
import { start, next, sendMetrics } from '@/src/features/quiz/datasource';
import { waitMockReady } from '@/src/lib/waitMockReady';

type State = {
  token?: string;
  question?: Question;
  progress?: { index: number; total: number };
  loading: boolean;
  error?: string;
  selectedId?: string;
  beganAt?: number; // ms timestamp for current question
  startedAt?: string; // ISO string for run start
  answeredCount: number;
  started: boolean;
};

const AUTO_START = process.env.NEXT_PUBLIC_PLAY_AUTOSTART !== '0';

export default function PlayPage() {
  const router = useRouter();
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const [s, setS] = React.useState<State>({
    loading: AUTO_START,
    answeredCount: 0,
    started: AUTO_START
  });

  const bootAndStart = React.useCallback(async () => {
    try {
      await waitMockReady({ timeoutMs: 2000 });

      let res: RoundsStartResponse | undefined;
      try {
        res = await start();
      } catch (e: unknown) {
        const isMock = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_MOCK === '1';
        const message = e instanceof Error ? e.message : String(e);
        if (isMock && /404/.test(message)) {
          await new Promise(r => setTimeout(r, 180));
          res = await start();
        } else {
          throw e;
        }
      }

      if (!isMountedRef.current) return;

      if (!res) {
        setS(prev => ({ ...prev, loading: false, error: 'Empty response from /v1/rounds/start' }));
        return;
      }

      setS({
        token: res.token,
        question: res.question,
        progress: res.progress ?? { index: 1, total: res.max },
        loading: false,
        error: undefined,
        selectedId: undefined,
        beganAt: performance.now(),
        startedAt: new Date().toISOString(),
        answeredCount: 0,
        started: true
      });
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      setS(prev => ({ ...prev, loading: false, error: message || 'Failed to start.' }));
    }
  }, []);

  // bootstrap (autostart mode)
  React.useEffect(() => {
    if (!AUTO_START) return;
    void bootAndStart();
  }, [bootAndStart]);

  const onClickStart = React.useCallback(async () => {
    setS(prev => ({ ...prev, loading: true, error: undefined, started: true }));
    await bootAndStart();
  }, [bootAndStart]);

  const submitAnswer = React.useCallback(async () => {
    if (!s.token || !s.question || !s.selectedId) return;
    setS(prev => ({ ...prev, loading: true, error: undefined }));

    const payload: MetricsRequest = {
      token: s.token,
      questionId: s.question.id,
      choiceId: s.selectedId,
      answeredAt: new Date().toISOString(),
      latencyMs: s.beganAt ? Math.round(performance.now() - s.beganAt) : undefined,
      extras: { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined }
    };
    sendMetrics(payload);

    // --- One-point fix: save the *current* question's reveal BEFORE calling next() ---
    try {
      const currentReveal = s.question?.reveal;
      if (currentReveal) {
        sessionStorage.setItem('vgm2.result.reveal', JSON.stringify(currentReveal));
      }
    } catch {}

    try {
      const res: RoundsNextResponse = await next();

      if (res.finished === true) {
        try {
          const answeredCount = s.answeredCount + 1;
          const summary = {
            answeredCount,
            total: s.progress?.total ?? answeredCount,
            startedAt: s.startedAt,
            finishedAt: new Date().toISOString()
          };
          sessionStorage.setItem('vgm2.result.summary', JSON.stringify(summary));
        } catch {}
        router.push('/result');
        return;
      }

      setS(prev => ({
        ...prev,
        loading: false,
        error: undefined,
        token: res.token ?? prev.token,
        question: res.question!,
        progress: res.progress ?? (prev.progress ? { index: prev.progress.index + 1, total: prev.progress.total } : undefined),
        selectedId: undefined,
        beganAt: performance.now(),
        answeredCount: prev.answeredCount + 1
      }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setS(prev => ({ ...prev, loading: false, error: message || 'Failed to load next.' }));
    }
  }, [
    s.token,
    s.question,
    s.selectedId,
    s.beganAt,
    s.answeredCount,
    s.progress?.total,
    s.startedAt,
    router
  ]);

  React.useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (s.loading || !s.question) return;

      if (/^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const c = s.question.choices[idx];
        if (c) {
          ev.preventDefault();
          setS(prev => ({ ...prev, selectedId: c.id }));
        }
        return;
      }
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const choices = s.question.choices;
        if (!choices.length) return;
        const curIdx = choices.findIndex(c => c.id === s.selectedId);
        const dir = ev.key === 'ArrowUp' ? -1 : 1;
        const nextIdx = ((curIdx >= 0 ? curIdx : -1) + dir + choices.length) % choices.length;
        setS(prev => ({ ...prev, selectedId: choices[nextIdx].id }));
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (s.selectedId) {
          void submitAnswer();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [s.loading, s.question, s.selectedId, submitAnswer]);

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto">
        {!s.started ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <h1 className="text-2xl font-semibold mb-4">Ready?</h1>
            {s.error ? <div className="mb-3 text-red-700">{s.error}</div> : null}
            <button
              type="button"
              onClick={onClickStart}
              className="px-4 py-2 rounded-xl bg-black text-white"
            >
              Start
            </button>
          </div>
        ) : (
          <>
            <Progress index={s.progress?.index} total={s.progress?.total} />
            {s.error ? <ErrorBanner message={s.error} /> : null}
            {!s.question && s.loading ? (
              <div className="text-gray-600">Loading...</div>
            ) : s.question ? (
              <QuestionCard
                prompt={s.question.prompt}
                choices={s.question.choices}
                selectedId={s.selectedId}
                disabled={s.loading}
                onSelect={(id) => setS(prev => ({ ...prev, selectedId: id }))}
                onSubmit={submitAnswer}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

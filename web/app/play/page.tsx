'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Question } from '../../src/features/quiz/api/types';
import * as ds from '../../src/features/quiz/datasource';
import ErrorBanner from '../../src/components/ErrorBanner';
import Progress from '../../src/components/Progress';
import QuestionCard from '../../src/components/QuestionCard';

export default function PlayPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [index, setIndex] = useState(0); // 1-based display (index+1)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<number>(0); // choice focus index
  const containerRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);

  const hasQuestion = !!question;
  const choices = question?.choices ?? [];

  // Start a new round
  async function handleStart() {
    setLoading(true);
    setError(null);
    const res = await ds.start();
    setLoading(false);
    if (!res.ok) {
      setError(`${res.error.code}: ${res.error.message}`);
      return;
    }
    setToken(res.data.token);
    setQuestion(res.data.question);
    setIndex(1);
    setFocused(0);
    startedAtRef.current = Date.now();
  }

  // After answering, go to next question or finish
  async function goNext(currToken: string) {
    setLoading(true);
    setError(null);
    const res = await ds.next(currToken);
    setLoading(false);
    if (!res.ok) {
      // If token invalid/expired, allow restart
      setError(`${res.error.code}: ${res.error.message}`);
      return;
    }
    if (res.data.finished) {
      const endedAt = Date.now();
      const startedAt = startedAtRef.current ?? endedAt;
      try {
        const summary = {
          answered: index,
          startedAt,
          endedAt,
          durationMs: Math.max(0, endedAt - startedAt),
        };
        sessionStorage.setItem('vgm:lastResult', JSON.stringify(summary));
      } catch {
        // ignore storage errors
      }
      router.push('/result');
      return;
    }
    setToken(res.data.token);
    setQuestion(res.data.question);
    setIndex((n) => n + 1);
    setFocused(0);
  }

  async function answer(choice: string) {
    if (!question || !token) return;
    // Send minimal metric (non-blocking UX: we await but ignore errors/responses)
    await ds.sendMetrics({
      events: [
        {
          type: 'answer',
          questionId: question.id,
          choice,
          at: new Date().toISOString(),
        },
      ],
    });
    await goNext(token);
  }

  // Keyboard: Up/Down to change focus, Enter to answer, 1..9 to select
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!hasQuestion || loading) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused((i) => (i + 1) % choices.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused((i) => (i - 1 + choices.length) % choices.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      answer(choices[focused]);
    } else if (/^[1-9]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < choices.length) {
        e.preventDefault();
        answer(choices[idx]);
      }
    }
  }

  useEffect(() => {
    // Focus the container for keyboard shortcuts when question appears
    if (question && containerRef.current) {
      containerRef.current.focus();
    }
  }, [question]);

  const isAuthError =
    (error?.startsWith('token_expired') ?? false) ||
    (error?.startsWith('invalid_token') ?? false);

  return (
    <main className="max-w-2xl mx-auto p-6" ref={containerRef} tabIndex={0} onKeyDown={onKeyDown}>
      <h1 className="text-2xl font-bold mb-4">Play</h1>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleStart}
          disabled={loading}
          className="rounded-2xl border px-4 py-2 shadow"
        >
          {token ? 'Restart' : 'Start'}
        </button>
        {index > 0 && <Progress current={index} />}
      </div>

      {error && (
        <ErrorBanner
          message={error}
          showRetry={isAuthError}
          onRetry={isAuthError ? handleStart : undefined}
        />
      )}

      {!question && !error && (
        <div className="rounded-2xl border p-6 text-center text-gray-600">
          <p className="mb-2">
            Click <strong>Start</strong> to begin the quiz.
          </p>
          <p className="text-sm">Keyboard: ↑↓ to move, Enter to answer, 1..9 for quick select</p>
        </div>
      )}

      {question && (
        <QuestionCard
          question={question}
          focusedIndex={focused}
          loading={loading}
          onAnswer={answer}
        />
      )}
    </main>
  );
}

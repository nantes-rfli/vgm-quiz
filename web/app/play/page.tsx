'use client';

import { useState } from 'react';
import type { Question } from '../../src/features/quiz/api/types';
import * as ds from '../../src/features/quiz/datasource';

export default function PlayPage() {
  const [token, setToken] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }

  async function handleNext() {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await ds.next(token);
    setLoading(false);
    if (!res.ok) {
      setError(`${res.error.code}: ${res.error.message}`);
      return;
    }
    setToken(res.data.token);
    setQuestion(res.data.question);
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Play (FE-03 minimal)</h1>

      <div className="flex gap-2">
        <button
          onClick={handleStart}
          disabled={loading}
          className="rounded-2xl border px-4 py-2 shadow"
        >
          Start
        </button>
        <button
          onClick={handleNext}
          disabled={loading || !token}
          className="rounded-2xl border px-4 py-2 shadow"
        >
          Next
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      <section className="rounded-2xl border p-4">
        <h2 className="font-semibold mb-2">State</h2>
        <p className="text-sm break-all"><strong>token:</strong> {token ?? '—'}</p>
      </section>

      {question && (
        <section className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">Question</h2>
          <p className="mb-2">{question.title}</p>
          <ul className="list-disc pl-5">
            {question.choices.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

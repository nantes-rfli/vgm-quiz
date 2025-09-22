// Path: web/app/result/page.tsx
'use client';

import React from 'react';
import { loadResult } from '@/src/lib/resultStorage';

export default function ResultPage() {
  const [ready, setReady] = React.useState(false);
  const [summary, setSummary] = React.useState<{ answeredCount: number; total: number; startedAt?: string; finishedAt?: string } | null>(null);

  React.useEffect(() => {
    const s = loadResult();
    setSummary(s ?? null);
    setReady(true);
  }, []);

  if (!ready) {
    return <main className="p-6"><div className="max-w-2xl mx-auto text-gray-600">Loading result...</div></main>;
  }

  if (!summary) {
    return (
      <main className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded-xl">
            No result found. Try a new round.
          </div>
        </div>
      </main>
    );
  }

  const started = summary.startedAt ? new Date(summary.startedAt) : undefined;
  const finished = summary.finishedAt ? new Date(summary.finishedAt) : undefined;

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Result</h1>
        <div className="bg-white rounded-2xl shadow p-6">
          <p className="mb-2">Answered: <strong>{summary.answeredCount}</strong> / {summary.total}</p>
          {started ? <p className="text-sm text-gray-600">Started at: {started.toLocaleString()}</p> : null}
          {finished ? <p className="text-sm text-gray-600">Finished at: {finished.toLocaleString()}</p> : null}
        </div>
        <div className="mt-6">
          <a href="/play" className="inline-block px-4 py-2 rounded-xl bg-black text-white">Play again</a>
        </div>
      </div>
    </main>
  );
}

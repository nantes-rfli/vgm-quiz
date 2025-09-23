'use client';

import React from 'react';
import ScoreBadge from '@/src/components/ScoreBadge';
import { loadResult } from '@/src/lib/resultStorage';
import type { ResultSummary } from '@/src/lib/resultStorage';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import RevealCard from '@/src/components/RevealCard';
import type { Reveal } from '@/src/features/quiz/api/types';

function isReveal(x: unknown): x is Reveal {
  if (typeof x !== 'object' || x === null) return false;
  const maybe = x as { links?: unknown };
  return Array.isArray(maybe.links);
}

export default function ResultPage() {
  const [ready, setReady] = React.useState(false);
  const [summary, setSummary] = React.useState<{ answeredCount: number; total: number; startedAt?: string; finishedAt?: string } | null>(null);
  const [reveal, setReveal] = React.useState<Reveal | undefined>(undefined);

  React.useEffect(() => {
    const s = (loadResult() ?? { answeredCount: 0, total: 0 }) as ResultSummary;
    setSummary(s ?? null);

    try {
      const raw = sessionStorage.getItem('vgm2.result.reveal');
      if (raw) {
        const obj = JSON.parse(raw) as unknown;
        if (isReveal(obj)) {
          setReveal(obj);
        }
      }
    } catch {
      // ignore parse errors
    }

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
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Result</h1>
          <InlinePlaybackToggle />
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-end mb-2">
        <ScoreBadge correct={0} wrong={0} unknown={summary.answeredCount ?? 0} total={summary.total} />
      </div>
    
          <p className="mb-2">Answered: <strong>{summary.answeredCount}</strong> / {summary.total}</p>
          {started ? <p className="text-sm text-gray-600">Started at: {started.toLocaleString()}</p> : null}
          {finished ? <p className="text-sm text-gray-600">Finished at: {finished.toLocaleString()}</p> : null}
        </div>

        <RevealCard reveal={reveal} />

        <div className="mt-6">
          <a href="/play" className="inline-block px-4 py-2 rounded-xl bg-black text-white">Play again</a>
        </div>
      </div>
    </main>
  );
}

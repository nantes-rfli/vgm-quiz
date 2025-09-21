'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface LastResult {
  answered: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ResultPage() {
  const [last, setLast] = useState<LastResult | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('vgm:lastResult');
      if (raw) {
        const obj = JSON.parse(raw) as LastResult;
        setLast(obj);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Result</h1>

      {!last && (
        <p className="text-gray-600">No result found. Try a new round.</p>
      )}

      {last && (
        <div className="rounded-2xl border p-4">
          <p className="mb-2">Answered questions: <strong>{last.answered}</strong></p>
          <p className="mb-2">Duration: <strong>{formatDuration(last.durationMs)}</strong></p>
          <p className="text-sm text-gray-500">
            Started: {new Date(last.startedAt).toLocaleString()}
            <br />
            Ended: {new Date(last.endedAt).toLocaleString()}
          </p>
        </div>
      )}

      <div>
        <Link href="/play" className="inline-block rounded-2xl border px-4 py-2 shadow">
          Play again
        </Link>
      </div>
    </main>
  );
}

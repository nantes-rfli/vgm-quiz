'use client';

import React from 'react';
import ScoreBadge from '@/src/components/ScoreBadge';
import { loadResult, loadReveals, type ResultSummary, type Outcome } from '@/src/lib/resultStorage';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import type { Reveal } from '@/src/features/quiz/api/types';

function outcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case 'correct':
      return 'Correct';
    case 'wrong':
      return 'Wrong';
    case 'timeout':
      return 'Timeout';
    case 'skip':
      return 'Skipped';
    default:
      return outcome;
  }
}

function outcomeClass(outcome: Outcome): string {
  switch (outcome) {
    case 'correct':
      return 'text-emerald-700';
    case 'wrong':
      return 'text-rose-700';
    case 'timeout':
      return 'text-orange-600';
    case 'skip':
      return 'text-slate-600';
    default:
      return 'text-gray-500';
  }
}

function toSeconds(ms: number): number {
  return Math.max(0, Math.floor(ms / 1000));
}

export default function ResultPage() {
  const [ready, setReady] = React.useState(false);
  const [summary, setSummary] = React.useState<ResultSummary | null>(null);
  const [reveals, setReveals] = React.useState<Reveal[]>([]);

  React.useEffect(() => {
    setSummary(loadResult() ?? null);
    setReveals(loadReveals<Reveal>());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="p-6">
        <div className="max-w-2xl mx-auto text-gray-600">Loading result...</div>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded-xl">
            No result found. Try a new round.
          </div>
          <div className="mt-4 text-right">
            <a href="/play" className="inline-block px-4 py-2 rounded-xl bg-black text-white">Play again</a>
          </div>
        </div>
      </main>
    );
  }

  const started = summary.startedAt ? new Date(summary.startedAt) : undefined;
  const finished = summary.finishedAt ? new Date(summary.finishedAt) : undefined;
  const durationSec = summary.durationMs ? Math.round(summary.durationMs / 1000) : undefined;
  const combined = summary.questions.map((record, idx) => ({ record, reveal: reveals[idx] }));

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Result</h1>
          <InlinePlaybackToggle />
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <ScoreBadge
              correct={summary.score.correct}
              wrong={summary.score.wrong}
              timeout={summary.score.timeout}
              skip={summary.score.skip}
              points={summary.score.points}
              total={summary.total}
            />
            <div className="text-xs text-gray-500 space-y-1 text-right">
              <div>Answered: <strong>{summary.answeredCount}</strong> / {summary.total}</div>
              {durationSec ? <div>Duration: {durationSec}s</div> : null}
              {started ? <div>Started: {started.toLocaleString()}</div> : null}
              {finished ? <div>Finished: {finished.toLocaleString()}</div> : null}
            </div>
          </div>
        </div>

        <div className="mt-4 text-right">
          <a href="/play" className="inline-block px-4 py-2 rounded-xl bg-black text-white">Play again</a>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Question breakdown</h2>
          {combined.length === 0 ? (
            <div className="text-sm text-gray-600">No question history recorded.</div>
          ) : (
            <ul className="space-y-3">
              {combined.map(({ record, reveal }, idx) => {
                const link = Array.isArray(reveal?.links) && reveal.links.length > 0 ? reveal.links[0] : undefined;
                const meta = reveal?.meta;
                return (
                  <li key={record.questionId} className="p-4 rounded-xl bg-white shadow">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">#{idx + 1} — {record.prompt}</div>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className={`${outcomeClass(record.outcome)} font-semibold`}>
                              {outcomeLabel(record.outcome)}
                            </span>
                            <span>Remaining {toSeconds(record.remainingMs)}s</span>
                            <span>Points {record.points}</span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-gray-500">
                            <div>
                              Your answer: {record.choiceLabel ?? '—'}
                            </div>
                            {record.correctLabel ? (
                              <div>Correct: {record.correctLabel}</div>
                            ) : null}
                          </div>
                        </div>
                        {record.points > 0 ? (
                          <span className="text-sm font-semibold text-emerald-700">+{record.points}</span>
                        ) : null}
                      </div>

                      {reveal ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                          <div className="text-xs text-gray-500 space-y-1">
                            {meta?.workTitle ? <div>Work: {meta.workTitle}</div> : null}
                            {meta?.trackTitle ? <div>Track: {meta.trackTitle}</div> : null}
                            {meta?.composer ? <div>Composer: {meta.composer}</div> : null}
                          </div>
                          {link ? (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-4 py-2 rounded-xl bg-black text-white"
                            >
                              Open in {link.provider}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">No link</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import React from 'react';
import ScoreBadge from '@/src/components/ScoreBadge';
import { loadResult, loadReveals, type ResultSummary } from '@/src/lib/resultStorage';
import { mark, measure } from '@/src/lib/perfMarks';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import type { Reveal } from '@/src/features/quiz/api/types';
import { msToSeconds } from '@/src/lib/timeUtils';
import { getOutcomeDisplay } from '@/src/lib/outcomeUtils';

export default function ResultPage() {
  const [ready, setReady] = React.useState(false);
  const [summary, setSummary] = React.useState<ResultSummary | null>(null);
  const [reveals, setReveals] = React.useState<Reveal[]>([]);

  React.useEffect(() => {
    setSummary(loadResult() ?? null);
    setReveals(loadReveals<Reveal>());
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready || !summary) return;
    mark('quiz:result-ready', { answered: summary.answeredCount });
    measure('quiz:first-question-to-result', 'quiz:first-question-visible', 'quiz:result-ready', {
      answered: summary.answeredCount,
    });
    measure('quiz:finish-to-result', 'quiz:play-finished', 'quiz:result-ready', {
      answered: summary.answeredCount,
    });
  }, [ready, summary]);

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
          <h1 id="result-summary-heading" className="text-2xl font-semibold">Result</h1>
          <InlinePlaybackToggle />
        </div>

        <section className="bg-white rounded-2xl shadow p-6" aria-labelledby="result-summary-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <ScoreBadge
              correct={summary.score.correct}
              wrong={summary.score.wrong}
              timeout={summary.score.timeout}
              skip={summary.score.skip}
              points={summary.score.points}
              total={summary.total}
            />
            <dl className="text-xs text-gray-700 space-y-1 text-right">
              <div>
                <dt className="sr-only">Answered questions</dt>
                <dd>
                  Answered: <strong>{summary.answeredCount}</strong> / {summary.total}
                </dd>
              </div>
              {durationSec ? (
                <div>
                  <dt className="sr-only">Duration</dt>
                  <dd>Duration: {durationSec}s</dd>
                </div>
              ) : null}
              {started ? (
                <div>
                  <dt className="sr-only">Started at</dt>
                  <dd>Started: {started.toLocaleString()}</dd>
                </div>
              ) : null}
              {finished ? (
                <div>
                  <dt className="sr-only">Finished at</dt>
                  <dd>Finished: {finished.toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

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
                const outcome = getOutcomeDisplay(record.outcome);
                return (
                  <li key={record.questionId} className="p-4 rounded-xl bg-white shadow">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">#{idx + 1} — {record.prompt}</div>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className={`${outcome.className} font-semibold`}>
                              {outcome.label}
                            </span>
                            <span>Remaining {msToSeconds(record.remainingMs)}s</span>
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
                          <dl className="text-xs text-gray-700 space-y-1">
                            {meta?.workTitle ? (
                              <div>
                                <dt className="font-medium text-gray-600">Work</dt>
                                <dd>{meta.workTitle}</dd>
                              </div>
                            ) : null}
                            {meta?.trackTitle ? (
                              <div>
                                <dt className="font-medium text-gray-600">Track</dt>
                                <dd>{meta.trackTitle}</dd>
                              </div>
                            ) : null}
                            {meta?.composer ? (
                              <div>
                                <dt className="font-medium text-gray-600">Composer</dt>
                                <dd>{meta.composer}</dd>
                              </div>
                            ) : null}
                          </dl>
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

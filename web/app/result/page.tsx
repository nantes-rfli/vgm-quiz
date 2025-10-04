'use client';

import React from 'react';
import { useI18n } from '@/src/lib/i18n';
import ScoreBadge from '@/src/components/ScoreBadge';
import { loadResult, loadReveals, type ResultSummary } from '@/src/lib/resultStorage';
import { mark, measure } from '@/src/lib/perfMarks';
import InlinePlaybackToggle from '@/src/components/InlinePlaybackToggle';
import ThemeToggle from '@/src/components/ThemeToggle';
import LocaleSwitcher from '@/src/components/LocaleSwitcher';
import type { Reveal } from '@/src/features/quiz/api/types';
import { msToSeconds } from '@/src/lib/timeUtils';
import { getOutcomeDisplay } from '@/src/lib/outcomeUtils';

export default function ResultPage() {
  const { t } = useI18n();
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
        <div className="max-w-2xl mx-auto text-muted-foreground">{t('result.loading')}</div>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 p-4 rounded-xl">
            {t('result.noResult')}
          </div>
          <div className="mt-4 text-right">
            <a href="/play" className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition">{t('result.playAgain')}</a>
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
          <h1 id="result-summary-heading" className="text-2xl font-semibold">{t('result.title')}</h1>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <ThemeToggle />
            <InlinePlaybackToggle />
          </div>
        </div>

        <section className="bg-card rounded-2xl shadow p-6 border border-border" aria-labelledby="result-summary-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <ScoreBadge
              correct={summary.score.correct}
              wrong={summary.score.wrong}
              timeout={summary.score.timeout}
              skip={summary.score.skip}
              points={summary.score.points}
              total={summary.total}
            />
            <dl className="text-xs text-card-foreground space-y-1 text-right">
              <div>
                <dt className="sr-only">Answered questions</dt>
                <dd>
                  {t('result.answered', { count: String(summary.answeredCount), total: String(summary.total) })}
                </dd>
              </div>
              {durationSec ? (
                <div>
                  <dt className="sr-only">Duration</dt>
                  <dd>{t('result.duration', { seconds: String(durationSec) })}</dd>
                </div>
              ) : null}
              {started ? (
                <div>
                  <dt className="sr-only">Started at</dt>
                  <dd>{t('result.started', { time: started.toLocaleString() })}</dd>
                </div>
              ) : null}
              {finished ? (
                <div>
                  <dt className="sr-only">Finished at</dt>
                  <dd>{t('result.finished', { time: finished.toLocaleString() })}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        <div className="mt-4 text-right">
          <a href="/play" className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition">{t('result.playAgain')}</a>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">{t('result.questionBreakdown')}</h2>
          {combined.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('result.noQuestions')}</div>
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
                          <div className="text-sm font-semibold text-gray-800">{t('result.questionNumber', { number: String(idx + 1) })} — {record.prompt}</div>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className={`${outcome.className} font-semibold`}>
                              {t(outcome.key)}
                            </span>
                            <span>{t('result.remainingSeconds', { seconds: String(msToSeconds(record.remainingMs)) })}</span>
                            <span>{t('result.pointsEarned', { points: String(record.points) })}</span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-gray-500">
                            <div>
                              {t('result.yourAnswerLabel', { answer: record.choiceLabel ?? '—' })}
                            </div>
                            {record.correctLabel ? (
                              <div>{t('result.correctAnswerLabel', { answer: record.correctLabel })}</div>
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
                                <dt className="font-medium text-gray-600">{t('result.workLabel')}</dt>
                                <dd>{meta.workTitle}</dd>
                              </div>
                            ) : null}
                            {meta?.trackTitle ? (
                              <div>
                                <dt className="font-medium text-gray-600">{t('result.trackLabel')}</dt>
                                <dd>{meta.trackTitle}</dd>
                              </div>
                            ) : null}
                            {meta?.composer ? (
                              <div>
                                <dt className="font-medium text-gray-600">{t('result.composerLabel')}</dt>
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
                              {t('result.openInProvider', { provider: link.provider })}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">{t('result.noLink')}</span>
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

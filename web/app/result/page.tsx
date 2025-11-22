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
import { loadAppliedFilters } from '@/src/lib/appliedFiltersStorage';

export default function ResultPage() {
  const { t } = useI18n();
  const [ready, setReady] = React.useState(false);
  const [summary, setSummary] = React.useState<ResultSummary | null>(null);
  const [reveals, setReveals] = React.useState<Reveal[]>([]);
  const [appliedFilters, setAppliedFilters] = React.useState<ReturnType<typeof loadAppliedFilters>>(undefined);

  React.useEffect(() => {
    setSummary(loadResult() ?? null);
    setReveals(loadReveals<Reveal>());
    setAppliedFilters(loadAppliedFilters());
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

          {/* Applied Filters Display */}
          {appliedFilters && (appliedFilters.difficulty || appliedFilters.era || (appliedFilters.series && appliedFilters.series.length > 0)) && (
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold mb-3 text-card-foreground">{t('result.appliedFilters')}</h3>
              <dl data-testid="applied-filters" className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {appliedFilters.difficulty && appliedFilters.difficulty !== 'mixed' && (
                  <div className="flex gap-2">
                    <dt className="font-medium">{t('filter.difficulty.label')}:</dt>
                    <dd data-testid="applied-filter-difficulty">{t(`filter.difficulty.${appliedFilters.difficulty}`)}</dd>
                  </div>
                )}
                {appliedFilters.era && appliedFilters.era !== 'mixed' && (
                  <div className="flex gap-2">
                    <dt className="font-medium">{t('filter.era.label')}:</dt>
                    <dd data-testid="applied-filter-era">{t(`filter.era.${appliedFilters.era}`)}</dd>
                  </div>
                )}
                {appliedFilters.series && appliedFilters.series.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="font-medium">{t('filter.series.label')}:</dt>
                    <dd data-testid="applied-filter-series">
                      {appliedFilters.series.map((s) => t(`filter.series.${s}`)).join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
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
                  <li key={record.questionId} className="p-4 rounded-xl bg-white dark:bg-card shadow border border-border">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground">{t('result.questionNumber', { number: String(idx + 1) })} — {record.prompt}</div>
                          <dl className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <div className="flex gap-2">
                              <dt className="sr-only">Outcome</dt>
                              <dd className={`${outcome.className} font-semibold`}>
                                {t(outcome.key)}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="sr-only">Time remaining</dt>
                              <dd>{t('result.remainingSeconds', { seconds: String(msToSeconds(record.remainingMs)) })}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="sr-only">Points earned</dt>
                              <dd>{t('result.pointsEarned', { points: String(record.points) })}</dd>
                            </div>
                          </dl>
                          <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <div className="flex gap-2">
                              <dt className="font-medium sr-only">{t('result.yourAnswerLabel', { answer: '...' })}</dt>
                              <dd>{t('result.yourAnswerLabel', { answer: record.choiceLabel ?? '—' })}</dd>
                            </div>
                            {record.correctLabel ? (
                              <div className="flex gap-2">
                                <dt className="font-medium sr-only">{t('result.correctAnswerLabel', { answer: '...' })}</dt>
                                <dd>{t('result.correctAnswerLabel', { answer: record.correctLabel })}</dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>
                        {record.points > 0 ? (
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-500">+{record.points}</span>
                        ) : null}
                      </div>

                      {reveal ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border dark:border-border pt-3">
                          <dl className="text-xs text-foreground space-y-1">
                            {meta?.workTitle ? (
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">{t('result.workLabel')}:</dt>
                                <dd>{meta.workTitle}</dd>
                              </div>
                            ) : null}
                            {meta?.trackTitle ? (
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">{t('result.trackLabel')}:</dt>
                                <dd>{meta.trackTitle}</dd>
                              </div>
                            ) : null}
                            {meta?.composer ? (
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">{t('result.composerLabel')}:</dt>
                                <dd>{meta.composer}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {link ? (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition"
                              aria-label={t('result.openInProvider', { provider: link.provider })}
                            >
                              {t('result.openInProvider', { provider: link.provider })}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('result.noLink')}</span>
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

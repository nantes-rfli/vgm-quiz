'use client';

import { useI18n } from '@/src/lib/i18n';

type Props = {
  correct: number;
  wrong: number;
  timeout?: number;
  skip?: number;
  points?: number;
  total?: number;
};

export default function ScoreBadge({ correct, wrong, timeout = 0, skip = 0, points = 0, total }: Props) {
  const { t } = useI18n();
  const unknown = timeout + skip;
  const answered = correct + wrong + unknown;
  return (
    <dl className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-1 text-sm text-card-foreground">
      <div className="flex items-center gap-2">
        <dt className="font-semibold">{t('result.score')}</dt>
        <dd className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground" aria-label={t('result.totalScore', { points: String(points) })}>
          {points}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Correct answers</dt>
        <dd className="px-2 py-0.5 rounded-full bg-emerald-700 dark:bg-emerald-600 text-white" aria-label={t('result.correctAnswers', { count: String(correct) })}>
          ✓ {correct}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Wrong answers</dt>
        <dd className="px-2 py-0.5 rounded-full bg-rose-700 dark:bg-rose-600 text-white" aria-label={t('result.wrongAnswers', { count: String(wrong) })}>
          ✕ {wrong}
        </dd>
      </div>
      {unknown > 0 ? (
        <div className="flex items-center gap-2">
          <dt className="sr-only">Not answered</dt>
          <dd className="px-2 py-0.5 rounded-full bg-slate-700 dark:bg-slate-600 text-white" aria-label={t('result.notAnswered', { count: String(unknown) })}>
            ? {unknown}
          </dd>
        </div>
      ) : null}
      {typeof total === 'number' ? (
        <div className="flex items-center gap-1">
          <dt className="sr-only">Total questions</dt>
          <dd className="text-card-foreground" aria-label={t('result.totalQuestions', { total: String(total) })}>
            / {total}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        <dt className="sr-only">Answered questions</dt>
        <dd className="text-muted-foreground">{t('result.answeredQuestions', { count: String(answered) })}</dd>
      </div>
    </dl>
  );
}

'use client';

import { useI18n } from '@/src/lib/i18n';
import { msToSeconds } from '@/src/lib/timeUtils';

type Props = {
  remainingMs: number;
  totalMs: number;
};

export default function Timer({ remainingMs, totalMs }: Props) {
  const { t } = useI18n();
  const clamped = Math.max(0, Math.min(remainingMs, totalMs));
  const ratio = totalMs === 0 ? 0 : clamped / totalMs;
  const seconds = msToSeconds(clamped, true);
  const danger = seconds <= 5;
  const liveText = `${t('play.timeRemaining')} ${seconds} seconds`;

  return (
    <div className="mb-3" role="timer" aria-live="polite" aria-atomic="false">
      <div className="flex items-center justify-between text-sm font-mono">
        <span aria-hidden className={danger ? 'text-rose-700 dark:text-rose-400 font-semibold' : 'text-foreground'}>
          {seconds}s
        </span>
        <span className="text-xs text-muted-foreground">{t('play.timeRemaining')}</span>
        <span className="sr-only">{liveText}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div
          className={`${danger ? 'bg-rose-600 dark:bg-rose-500' : 'bg-primary'} h-2 rounded-full transition-[width] duration-100`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

'use client';

type Props = {
  remainingMs: number;
  totalMs: number;
};

function formatSeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function Timer({ remainingMs, totalMs }: Props) {
  const clamped = Math.max(0, Math.min(remainingMs, totalMs));
  const ratio = totalMs === 0 ? 0 : clamped / totalMs;
  const seconds = formatSeconds(clamped);
  const danger = seconds <= 5;
  const liveText = `Time remaining ${seconds} seconds`;

  return (
    <div className="mb-3" role="timer" aria-live="polite" aria-atomic="false">
      <div className="flex items-center justify-between text-sm font-mono">
        <span aria-hidden className={danger ? 'text-rose-700 font-semibold' : 'text-gray-800'}>
          {seconds}s
        </span>
        <span className="text-xs text-gray-600">Time remaining</span>
        <span className="sr-only">{liveText}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-gray-200">
        <div
          className={`${danger ? 'bg-rose-600' : 'bg-gray-900'} h-2 rounded-full transition-[width] duration-100`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

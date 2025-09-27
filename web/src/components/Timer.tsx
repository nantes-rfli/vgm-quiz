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

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm font-mono">
        <span className={danger ? 'text-red-600 font-semibold' : 'text-gray-700'}>
          {seconds}s
        </span>
        <span className="text-xs text-gray-400">Time remaining</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-gray-200">
        <div
          className={`${danger ? 'bg-red-500' : 'bg-black'} h-2 rounded-full transition-[width] duration-100`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

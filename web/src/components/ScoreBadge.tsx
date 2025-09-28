'use client';

type Props = {
  correct: number;
  wrong: number;
  timeout?: number;
  skip?: number;
  points?: number;
  total?: number;
};

export default function ScoreBadge({ correct, wrong, timeout = 0, skip = 0, points = 0, total }: Props) {
  const unknown = timeout + skip;
  const answered = correct + wrong + unknown;
  return (
    <div className="inline-flex items-center gap-3 text-sm rounded-xl border border-gray-200 bg-white px-3 py-1 text-gray-700">
      <span className="font-semibold">Score</span>
      <span className="px-2 py-0.5 rounded-full bg-gray-900 text-white">{points}</span>
      <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white">✓ {correct}</span>
      <span className="px-2 py-0.5 rounded-full bg-rose-700 text-white">✕ {wrong}</span>
      {unknown > 0 ? (
        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-white">? {unknown}</span>
      ) : null}
      {typeof total === 'number' ? <span className="text-gray-700">/ {total}</span> : null}
      <span className="text-gray-600">({answered} answered)</span>
    </div>
  );
}

'use client';

type Props = {
  correct: number;
  wrong: number;
  unknown?: number;
  total?: number;
};

export default function ScoreBadge({ correct, wrong, unknown = 0, total }: Props) {
  const answered = correct + wrong + (unknown ?? 0);
  return (
    <div className="inline-flex items-center gap-3 text-sm rounded-full bg-gray-100 px-3 py-1">
      <span className="font-medium">Score</span>
      <span className="px-2 py-0.5 rounded-full bg-green-600 text-white">✓ {correct}</span>
      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white">✕ {wrong}</span>
      {unknown > 0 ? (
        <span className="px-2 py-0.5 rounded-full bg-gray-500 text-white">? {unknown}</span>
      ) : null}
      {typeof total === 'number' ? <span className="text-gray-500">/ {total}</span> : null}
      <span className="text-gray-400">({answered} answered)</span>
    </div>
  );
}

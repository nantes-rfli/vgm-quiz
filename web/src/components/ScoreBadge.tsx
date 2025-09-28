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
    <dl className="inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm text-gray-800">
      <div className="flex items-center gap-2">
        <dt className="font-semibold">Score</dt>
        <dd className="px-2 py-0.5 rounded-full bg-gray-900 text-white" aria-label={`Total score ${points}`}>
          {points}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Correct answers</dt>
        <dd className="px-2 py-0.5 rounded-full bg-emerald-700 text-white" aria-label={`Correct answers ${correct}`}>
          ✓ {correct}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Wrong answers</dt>
        <dd className="px-2 py-0.5 rounded-full bg-rose-700 text-white" aria-label={`Wrong answers ${wrong}`}>
          ✕ {wrong}
        </dd>
      </div>
      {unknown > 0 ? (
        <div className="flex items-center gap-2">
          <dt className="sr-only">Not answered</dt>
          <dd className="px-2 py-0.5 rounded-full bg-slate-700 text-white" aria-label={`Not answered ${unknown}`}>
            ? {unknown}
          </dd>
        </div>
      ) : null}
      {typeof total === 'number' ? (
        <div className="flex items-center gap-1">
          <dt className="sr-only">Total questions</dt>
          <dd className="text-gray-700" aria-label={`Total questions ${total}`}>
            / {total}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        <dt className="sr-only">Answered questions</dt>
        <dd className="text-gray-600">({answered} answered)</dd>
      </div>
    </dl>
  );
}

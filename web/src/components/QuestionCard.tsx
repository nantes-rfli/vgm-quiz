'use client';

import type { Question } from '../features/quiz/api/types';

function join(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface QuestionCardProps {
  question: Question;
  focusedIndex: number;
  loading?: boolean;
  onAnswer: (choice: string) => void;
}

export default function QuestionCard({
  question,
  focusedIndex,
  loading = false,
  onAnswer,
}: QuestionCardProps) {
  return (
    <div className="rounded-2xl border p-4 outline-none">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{question.title}</h2>
        {loading && <p className="text-sm">Loading…</p>}
      </div>

      <ul className="space-y-2">
        {question.choices.map((c, i) => {
          const isFocused = i === focusedIndex;
          return (
            <li key={c}>
              <button
                type="button"
                onClick={() => onAnswer(c)}
                disabled={loading}
                className={join(
                  'w-full text-left rounded-xl border px-4 py-3 transition',
                  isFocused && 'ring-2 ring-blue-500',
                  'hover:bg-gray-50'
                )}
              >
                <span className="font-medium mr-2">{i + 1}.</span>
                {c}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

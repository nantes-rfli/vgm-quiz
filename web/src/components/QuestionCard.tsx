// Quiz QuestionCard aligned with Choice[] and prompt
// Path: web/src/components/QuestionCard.tsx
'use client';

import React from 'react';
import type { Choice } from '@/src/features/quiz/api/types';

export type QuestionCardProps = {
  prompt: string;
  choices: Choice[];
  selectedId?: string;
  disabled?: boolean;
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
};

export default function QuestionCard({
  prompt,
  choices,
  selectedId,
  disabled,
  onSelect,
  onSubmit
}: QuestionCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <h2 className="text-xl font-semibold mb-4">{prompt}</h2>
        <ul className="space-y-2">
          {choices.map((c, idx) => {
            const isSelected = selectedId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(c.id)}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border transition',
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  ].join(' ')}
                >
                  <span className="inline-block w-6 mr-2 tabular-nums">{idx + 1}.</span>
                  <span>{c.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <button
            type="button"
            disabled={disabled || !selectedId}
            onClick={onSubmit}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:bg-gray-400"
          >
            Answer (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

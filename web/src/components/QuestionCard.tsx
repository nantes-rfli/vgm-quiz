// Quiz QuestionCard aligned with Choice[] and prompt
// Path: web/src/components/QuestionCard.tsx
'use client';

import React from 'react';
import { useI18n } from '@/src/lib/i18n';
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
  const { t } = useI18n();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl shadow p-6 mb-4 border border-border">
        <h2 className="text-xl font-semibold mb-4 text-card-foreground" data-testid="question-prompt" id="question-prompt">
          {prompt}
        </h2>
        <div role="radiogroup" aria-labelledby="question-prompt" className="space-y-2">
          {choices.map((c, idx) => {
            const isSelected = selectedId === c.id;
            return (
              <div key={c.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={disabled}
                  onClick={() => onSelect(c.id)}
                  data-testid={`choice-${c.id}`}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border transition',
                    isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400' : 'border-border hover:border-muted-foreground',
                    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  ].join(' ')}
                >
                  <span className="inline-block w-6 mr-2 tabular-nums">{idx + 1}.</span>
                  <span>{c.label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <button
            type="button"
            disabled={disabled || !selectedId}
            onClick={onSubmit}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
          >
            {t('play.answerButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

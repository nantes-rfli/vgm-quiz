import { useCallback } from 'react';
import { next } from './datasource';
import type { Question, RoundsNextResponse } from './api/types';
import { enrichReveal, toQuestionRecord } from './lib/reveal';
import { appendReveal } from '@/src/lib/resultStorage';
import { saveResult } from '@/src/lib/resultStorage';
import { computePoints, rollupTally, composeSummary } from '@/src/lib/scoring';
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient';
import { mark } from '@/src/lib/perfMarks';
import { TIMEOUT_CHOICE_ID, SKIP_CHOICE_ID, type PlayAction } from './playReducer';
import type { Outcome, ScoreBreakdown, QuestionRecord } from '@/src/lib/resultStorage';
import type { Reveal } from './api/types';
import type { ProgressInfo } from './playReducer';

type AnswerMode = { kind: 'answer' | 'timeout' | 'skip'; choiceId?: string };

type ProcessAnswerParams = {
  phase: 'question' | 'reveal';
  token?: string;
  question?: Question;
  remainingMs: number;
  beganAt?: number;
  currentReveal?: Reveal;
  history: QuestionRecord[];
  tally: ScoreBreakdown;
  progress?: ProgressInfo;
  startedAt?: string;
  dispatch: (action: PlayAction) => void;
};

/**
 * Custom hook for processing quiz answers.
 * Handles answer submission, scoring, reveal updates, and result persistence.
 */
export function useAnswerProcessor(params: ProcessAnswerParams) {
  const {
    phase,
    token,
    question,
    remainingMs,
    beganAt,
    currentReveal,
    history,
    tally,
    progress,
    startedAt,
    dispatch,
  } = params;

  return useCallback(
    async (mode: AnswerMode) => {
      if (phase === 'reveal' || !token || !question) return;
      if (mode.kind === 'answer' && !mode.choiceId) return;

      const remainingForCalc = Math.max(0, remainingMs);
      const elapsedMs = beganAt ? Math.round(performance.now() - beganAt) : undefined;

      // Switch to reveal phase immediately (freeze UI) and show current reveal
      dispatch({ type: 'ENTER_REVEAL', reveal: question.reveal });
      mark('quiz:reveal-visible', { questionId: question.id });

      const effectiveChoiceId =
        mode.kind === 'answer'
          ? mode.choiceId!
          : mode.kind === 'timeout'
            ? TIMEOUT_CHOICE_ID
            : SKIP_CHOICE_ID;

      try {
        const res: RoundsNextResponse = await next({ token, answer: { questionId: question.id, choiceId: effectiveChoiceId } });

        const enriched = enrichReveal(currentReveal, res.reveal, question.reveal);
        try { if (enriched) appendReveal(enriched); } catch {}

        const outcome: Outcome =
          mode.kind === 'timeout'
            ? 'timeout'
            : mode.kind === 'skip'
              ? 'skip'
              : enriched?.correct === true
                ? 'correct'
                : 'wrong';

        const points = outcome === 'correct' ? computePoints(remainingForCalc) : 0;
        const questionRecord = toQuestionRecord({
          question,
          reveal: enriched,
          outcome,
          remainingMs: remainingForCalc,
          choiceId: mode.kind === 'answer' ? mode.choiceId : undefined,
          points,
        });

        const updatedHistory = [...history, questionRecord];
        const updatedTally = rollupTally(tally, outcome, points);

        recordMetricsEvent('answer_result', {
          roundId: token,
          questionIdx: progress?.index,
          attrs: {
            questionId: question.id,
            outcome,
            points,
            remainingSeconds: Math.floor(remainingForCalc / 1000),
            choiceId: questionRecord.choiceId,
            correctChoiceId: questionRecord.correctChoiceId,
            elapsedMs,
          },
        });

        dispatch({ type: 'APPLY_RESULT', payload: { tally: updatedTally, history: updatedHistory } });

        if (res.finished === true) {
          const finishedAt = new Date().toISOString();
          const totalQuestions = progress?.total ?? updatedHistory.length;
          const durationMs = startedAt ? Date.parse(finishedAt) - Date.parse(startedAt) : undefined;
          saveResult(
            composeSummary({
              tally: updatedTally,
              history: updatedHistory,
              total: totalQuestions,
              startedAt,
              finishedAt,
            })
          );

          recordMetricsEvent('quiz_complete', {
            roundId: token,
            attrs: {
              total: totalQuestions,
              points: updatedTally.points,
              correct: updatedTally.correct,
              wrong: updatedTally.wrong,
              timeout: updatedTally.timeout,
              skip: updatedTally.skip,
              durationMs,
            },
          });
        }

        dispatch({ type: 'QUEUE_NEXT', next: res, reveal: enriched });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        dispatch({ type: 'ERROR', error: message || 'Failed to load next.' });
      }
    },
    [phase, token, question, remainingMs, dispatch, beganAt, currentReveal, history, tally, progress?.total, progress?.index, startedAt]
  );
}
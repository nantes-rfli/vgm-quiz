import { useCallback } from 'react';
import { next } from './datasource';
import type { Question, Phase1NextResponse } from './api/types';
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
  continuationToken?: string; // Phase 1: token → continuationToken
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
    continuationToken,
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
      if (phase === 'reveal' || !continuationToken || !question) return;
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
        // Phase 1: answer is just the choice ID (string)
        const res: Phase1NextResponse = await next({ continuationToken, answer: effectiveChoiceId });

        // Phase 1: result is directly in response, not nested in reveal
        const { result } = res;

        // Build reveal object from Phase1 format, including links
        const links: Array<{ provider: 'youtube' | 'spotify' | 'appleMusic' | 'other'; url: string }> = [];

        if (result.reveal.youtube_url) {
          links.push({ provider: 'youtube', url: result.reveal.youtube_url });
        }
        if (result.reveal.spotify_url) {
          links.push({ provider: 'spotify', url: result.reveal.spotify_url });
        }

        const phase1Reveal = {
          correct: result.correct,
          correctChoiceId: result.correctAnswer,
          meta: {
            trackTitle: result.reveal.title,
            workTitle: result.reveal.game,
            composer: result.reveal.composer,
          },
          links: links.length > 0 ? links : undefined,
        };

        const enriched = enrichReveal(currentReveal, phase1Reveal, question.reveal);
        try { if (enriched) appendReveal(enriched); } catch {}

        const outcome: Outcome =
          mode.kind === 'timeout'
            ? 'timeout'
            : mode.kind === 'skip'
              ? 'skip'
              : result.correct === true
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
          roundId: continuationToken,
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
            roundId: continuationToken,
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

        // Phase 1: convert Phase1NextResponse question format (title/text) to internal format (prompt/label)
        const convertedRes = res.question
          ? {
              ...res,
              question: {
                id: res.question.id,
                prompt: res.question.title,
                choices: (res.choices ?? []).map(c => ({
                  id: c.id,
                  label: c.text,
                })),
                // MSW fixtures have these fields; real Phase1 API won't, but we'll handle that in Phase2
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reveal: (res.question as any).reveal,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                artwork: (res.question as any).artwork,
              },
            }
          : res;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatch({ type: 'QUEUE_NEXT', next: convertedRes as any, reveal: enriched });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        dispatch({ type: 'ERROR', error: message || 'Failed to load next.' });
      }
    },
    [phase, continuationToken, question, remainingMs, dispatch, beganAt, currentReveal, history, tally, progress?.total, progress?.index, startedAt]
  );
}
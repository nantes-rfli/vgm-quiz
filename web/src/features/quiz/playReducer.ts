import type { Question, RoundsNextResponse, Phase1NextResponse, Reveal } from './api/types';
import type { QuestionRecord, ScoreBreakdown } from '@/src/lib/resultStorage';

export type ProgressInfo = { index: number; total: number };

export const QUESTION_TIME_LIMIT_MS = 15_000;
export const TIMEOUT_CHOICE_ID = '__timeout__';
export const SKIP_CHOICE_ID = '__skip__';

export type PlayState = {
  token?: string;
  question?: Question;
  progress?: ProgressInfo;
  loading: boolean;
  error?: string;
  selectedId?: string;
  beganAt?: number; // ms timestamp for current question
  startedAt?: string; // ISO string for run start
  started: boolean;
  phase: 'question' | 'reveal';
  queuedNext?: RoundsNextResponse | Phase1NextResponse; // Phase 1: support both formats
  currentReveal?: Reveal;
  deadline?: number;
  remainingMs: number;
  tally: ScoreBreakdown;
  history: QuestionRecord[];
};

export type PlayAction =
  | { type: 'BOOTING' }
  | {
      type: 'STARTED';
      payload: {
        token: string;
        question?: Question;
        progress?: ProgressInfo;
        beganAt: number;
        startedAt: string;
        currentReveal?: Reveal;
      };
    }
  | { type: 'ERROR'; error: string }
  | { type: 'SELECT'; id: string }
  | { type: 'ENTER_REVEAL'; reveal?: Reveal }
  | { type: 'QUEUE_NEXT'; next: RoundsNextResponse | Phase1NextResponse; reveal?: Reveal } // Phase 1: support both
  | { type: 'ADVANCE'; next: RoundsNextResponse | Phase1NextResponse } // Phase 1: support both
  | { type: 'TICK'; remainingMs: number }
  | { type: 'APPLY_RESULT'; payload: { tally: ScoreBreakdown; history: QuestionRecord[] } };

const EMPTY_TALLY: ScoreBreakdown = { correct: 0, wrong: 0, timeout: 0, skip: 0, points: 0 };

export function createInitialState(autoStart: boolean): PlayState {
  return {
    loading: autoStart,
    started: autoStart,
    phase: 'question',
    remainingMs: QUESTION_TIME_LIMIT_MS,
    tally: { ...EMPTY_TALLY },
    history: [],
  };
}

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case 'BOOTING':
      return { ...state, loading: true, error: undefined, started: true };

    case 'STARTED': {
      const { token, question, progress, beganAt, startedAt, currentReveal } = action.payload;
      return {
        token,
        question,
        progress,
        loading: false,
        error: undefined,
        selectedId: undefined,
        beganAt,
        startedAt,
        started: true,
        phase: 'question',
        queuedNext: undefined,
        currentReveal,
        deadline: beganAt + QUESTION_TIME_LIMIT_MS,
        remainingMs: QUESTION_TIME_LIMIT_MS,
        tally: { ...EMPTY_TALLY },
        history: [],
      };
    }

    case 'ERROR': {
      const hasQuestion = Boolean(state.question);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const nextDeadline = hasQuestion && state.remainingMs > 0 ? now + state.remainingMs : undefined;

      return {
        ...state,
        loading: false,
        error: action.error,
        phase: hasQuestion ? 'question' : state.phase,
        queuedNext: undefined,
        deadline: nextDeadline ?? state.deadline,
      };
    }

    case 'SELECT':
      return { ...state, selectedId: action.id };

    case 'ENTER_REVEAL':
      return { ...state, phase: 'reveal', loading: false, error: undefined, currentReveal: action.reveal };

    case 'QUEUE_NEXT': {
      return { ...state, queuedNext: action.next, currentReveal: action.reveal ?? state.currentReveal };
    }

    case 'ADVANCE': {
      const qn = action.next;
      // NOTE: caller must handle finished-case navigation before dispatching ADVANCE

      // Phase 1: check if response has 'round' property (Phase 2) or 'continuationToken' (Phase 1)
      const isPhase1 = 'continuationToken' in qn;

      const nextProgress: ProgressInfo | undefined = isPhase1
        ? (state.progress ? { index: state.progress.index + 1, total: state.progress.total } : undefined)
        : (qn as RoundsNextResponse).round?.progress ?? (state.progress ? { index: state.progress.index + 1, total: state.progress.total } : undefined);

      const nextToken = isPhase1
        ? (qn as Phase1NextResponse).continuationToken ?? state.token
        : (qn as RoundsNextResponse).round?.token ?? state.token;

      // Phase 1: question has been converted to Question format by useAnswerProcessor
      // Safe to use qn.question directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextQuestion = (qn as any).question as Question | undefined;

      return {
        ...state,
        loading: false,
        error: undefined,
        token: nextToken,
        question: nextQuestion!,
        progress: nextProgress,
        selectedId: undefined,
        beganAt: performance.now(),
        phase: 'question',
        queuedNext: undefined,
        currentReveal: undefined,
        deadline: performance.now() + QUESTION_TIME_LIMIT_MS,
        remainingMs: QUESTION_TIME_LIMIT_MS,
      };
    }

    case 'TICK':
      return { ...state, remainingMs: Math.max(0, Math.round(action.remainingMs)) };

    case 'APPLY_RESULT':
      return { ...state, tally: action.payload.tally, history: action.payload.history };

    default:
      return state;
  }
}

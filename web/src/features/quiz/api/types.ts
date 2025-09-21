// API response/DTO types aligned with current MSW fixtures
export interface Question {
  id: string;
  title: string;
  choices: string[];
}

export interface StartResponse {
  token: string;
  question: Question;
}

export interface NextResponse {
  token: string;
  question: Question;
  finished?: boolean; // true when round finished (optional in MSW for now)
}

// ---- Metrics (minimal) ----
export type MetricEventType = 'answer';

export interface AnswerEvent {
  type: MetricEventType; // "answer"
  questionId: string;
  choice: string;
  at: string; // ISO timestamp
}

export interface MetricsRequest {
  events: AnswerEvent[];
}

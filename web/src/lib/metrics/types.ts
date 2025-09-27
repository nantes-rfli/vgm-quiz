export type MetricsEventName =
  | 'answer_select'
  | 'answer_result'
  | 'quiz_complete'
  | 'reveal_open_external'
  | 'embed_error'
  | 'embed_fallback_to_link'
  | 'settings_inline_toggle';

export interface MetricsEvent {
  id: string;
  name: MetricsEventName;
  ts: string; // ISO8601
  round_id?: string;
  question_idx?: number;
  attrs?: Record<string, unknown>;
}

export interface MetricsBatch {
  client: {
    client_id: string;
    app_version?: string;
    tz?: string;
  };
  events: MetricsEvent[];
}

export interface PendingEvent extends MetricsEvent {
  retryCount: number;
  nextAttempt: number;
  idempotencyKey: string;
}

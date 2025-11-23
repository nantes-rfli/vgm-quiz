export const METRICS_EVENT_NAMES = [
  'answer_select',
  'answer_result',
  'quiz_start',
  'quiz_complete',
  'quiz_resume',
  'quiz_revisit',
  'reveal_open_external',
  'embed_error',
  'embed_fallback_to_link',
  'settings_inline_toggle',
  'settings_theme_toggle',
  'settings_locale_toggle',
] as const;

export type MetricsEventName = (typeof METRICS_EVENT_NAMES)[number];

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

import { z } from 'zod'
import { METRICS_EVENT_NAMES } from './types'
import type { MetricsBatch, MetricsEvent, PendingEvent } from './types'

type MetricsAttributeValue =
  | string
  | number
  | boolean
  | null
  | MetricsAttributeValue[]
  | { [key: string]: MetricsAttributeValue }

const metricsAttributeValueSchema: z.ZodType<MetricsAttributeValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(metricsAttributeValueSchema).max(50),
    z.record(metricsAttributeValueSchema),
  ]),
)

export const MetricsEventSchema = z.object({
  id: z.string().min(1),
  name: z.enum(METRICS_EVENT_NAMES),
  ts: z.string().min(1),
  round_id: z.string().min(1).optional(),
  question_idx: z.number().int().min(0).optional(),
  attrs: z.record(metricsAttributeValueSchema).optional(),
}) satisfies z.ZodType<MetricsEvent>

export const PendingEventSchema = MetricsEventSchema.extend({
  retryCount: z.number().int().min(0),
  nextAttempt: z.number().int().min(0),
  idempotencyKey: z.string().min(1),
}) satisfies z.ZodType<PendingEvent>

export const MetricsBatchSchema = z.object({
  client: z.object({
    client_id: z.string().min(1),
    app_version: z.string().min(1).optional(),
    tz: z.string().min(1).optional(),
  }),
  events: z.array(MetricsEventSchema).nonempty(),
}) satisfies z.ZodType<MetricsBatch>

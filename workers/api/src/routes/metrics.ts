import type { Env } from '../../../shared/types/env'

// Allowed event names (MVP)
const ALLOWED_EVENT_NAMES = new Set([
  'answer_select',
  'answer_result',
  'quiz_complete',
  'reveal_open_external',
  'embed_error',
  'embed_fallback_to_link',
  'settings_inline_toggle',
  'settings_theme_toggle',
  'settings_locale_toggle',
  'artwork_open',
])

// Constants
const MAX_EVENTS_PER_BATCH = 100
const MAX_BODY_SIZE_BYTES = 256 * 1024 // 256 KB
const MAX_ATTRS_SIZE_BYTES = 2 * 1024 // 2 KB per event
const TIMESTAMP_TOLERANCE_MS = 24 * 60 * 60 * 1000 // ±24 hours

interface MetricsEvent {
  id: string
  name: string
  ts: string
  round_id?: string
  question_idx?: number
  attrs?: Record<string, unknown>
}

interface MetricsBatch {
  client: {
    client_id: string
    app_version?: string
    tz?: string
  }
  events: MetricsEvent[]
}

interface ValidationError {
  field: string
  message: string
}

/**
 * Validate metrics batch payload
 */
function validateBatch(batch: unknown): {
  valid: boolean
  errors: ValidationError[]
  data?: MetricsBatch
} {
  const errors: ValidationError[] = []

  // Check if batch is an object
  if (!batch || typeof batch !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
    }
  }

  const data = batch as Record<string, unknown>

  // Validate client
  if (!data.client || typeof data.client !== 'object') {
    errors.push({ field: 'client', message: 'client is required and must be an object' })
  } else {
    const client = data.client as Record<string, unknown>
    if (!client.client_id || typeof client.client_id !== 'string') {
      errors.push({
        field: 'client.client_id',
        message: 'client_id is required and must be a string',
      })
    }
    if (client.app_version !== undefined && typeof client.app_version !== 'string') {
      errors.push({ field: 'client.app_version', message: 'app_version must be a string' })
    }
    if (client.tz !== undefined && typeof client.tz !== 'string') {
      errors.push({ field: 'client.tz', message: 'tz must be a string' })
    }
  }

  // Validate events array
  if (!Array.isArray(data.events)) {
    errors.push({ field: 'events', message: 'events must be an array' })
  } else {
    const events = data.events as unknown[]

    if (events.length === 0) {
      errors.push({ field: 'events', message: 'events array cannot be empty' })
    } else if (events.length > MAX_EVENTS_PER_BATCH) {
      errors.push({
        field: 'events',
        message: `events array exceeds maximum of ${MAX_EVENTS_PER_BATCH}`,
      })
    }

    // Validate each event
    events.forEach((event, idx) => {
      if (!event || typeof event !== 'object') {
        errors.push({ field: `events[${idx}]`, message: 'event must be an object' })
        return
      }

      const evt = event as Record<string, unknown>

      // Validate id
      if (!evt.id || typeof evt.id !== 'string') {
        errors.push({ field: `events[${idx}].id`, message: 'id is required and must be a string' })
      }

      // Validate name
      if (!evt.name || typeof evt.name !== 'string') {
        errors.push({
          field: `events[${idx}].name`,
          message: 'name is required and must be a string',
        })
      } else if (!ALLOWED_EVENT_NAMES.has(evt.name)) {
        errors.push({
          field: `events[${idx}].name`,
          message: `name "${evt.name}" is not in allowed vocabulary`,
        })
      }

      // Validate timestamp
      if (!evt.ts || typeof evt.ts !== 'string') {
        errors.push({
          field: `events[${idx}].ts`,
          message: 'ts is required and must be an ISO8601 string',
        })
      } else {
        const eventTime = new Date(evt.ts).getTime()
        const now = Date.now()
        if (Number.isNaN(eventTime)) {
          errors.push({
            field: `events[${idx}].ts`,
            message: 'ts is not a valid ISO8601 timestamp',
          })
        } else if (Math.abs(eventTime - now) > TIMESTAMP_TOLERANCE_MS) {
          errors.push({ field: `events[${idx}].ts`, message: 'ts is outside ±24 hour tolerance' })
        }
      }

      // Validate optional fields
      if (evt.round_id !== undefined && typeof evt.round_id !== 'string') {
        errors.push({ field: `events[${idx}].round_id`, message: 'round_id must be a string' })
      }
      if (evt.question_idx !== undefined && typeof evt.question_idx !== 'number') {
        errors.push({
          field: `events[${idx}].question_idx`,
          message: 'question_idx must be a number',
        })
      }
      if (evt.attrs !== undefined) {
        if (typeof evt.attrs !== 'object' || evt.attrs === null) {
          errors.push({ field: `events[${idx}].attrs`, message: 'attrs must be an object' })
        } else {
          const attrsSize = JSON.stringify(evt.attrs).length
          if (attrsSize > MAX_ATTRS_SIZE_BYTES) {
            errors.push({
              field: `events[${idx}].attrs`,
              message: `attrs size (${attrsSize} bytes) exceeds recommended ${MAX_ATTRS_SIZE_BYTES} bytes`,
            })
          }
        }
      }
    })
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [], data: data as unknown as MetricsBatch }
}

/**
 * Clean up old deduplication entries (>24h)
 */
async function cleanupDeduplication(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - TIMESTAMP_TOLERANCE_MS).toISOString()
  await db.prepare('DELETE FROM metrics_deduplication WHERE received_at < ?').bind(cutoff).run()
}

/**
 * Check if event is duplicate
 */
async function isDuplicate(db: D1Database, clientId: string, eventId: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM metrics_deduplication WHERE client_id = ? AND event_id = ?')
    .bind(clientId, eventId)
    .first()
  return result !== null
}

/**
 * Insert event into database
 */
async function insertEvent(
  db: D1Database,
  batch: MetricsBatch,
  event: MetricsEvent,
): Promise<void> {
  const attrsJson = event.attrs ? JSON.stringify(event.attrs) : null

  // Insert into metrics_events
  await db
    .prepare(`
      INSERT INTO metrics_events (
        event_id, client_id, event_name, event_ts, round_id, question_idx, attrs, app_version, tz
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      event.id,
      batch.client.client_id,
      event.name,
      event.ts,
      event.round_id ?? null,
      event.question_idx ?? null,
      attrsJson,
      batch.client.app_version ?? null,
      batch.client.tz ?? null,
    )
    .run()

  // Insert into deduplication table
  await db
    .prepare('INSERT INTO metrics_deduplication (client_id, event_id) VALUES (?, ?)')
    .bind(batch.client.client_id, event.id)
    .run()
}

/**
 * Handle POST /v1/metrics
 */
export async function handleMetricsRequest(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
  }

  try {
    // Check content length
    const contentLength = request.headers.get('content-length')
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          error: 'payload_too_large',
          message: `Request body exceeds ${MAX_BODY_SIZE_BYTES} bytes`,
        }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse body
    let body: unknown
    try {
      const text = await request.text()
      if (text.length > MAX_BODY_SIZE_BYTES) {
        return new Response(
          JSON.stringify({
            error: 'payload_too_large',
            message: `Request body exceeds ${MAX_BODY_SIZE_BYTES} bytes`,
          }),
          {
            status: 413,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
      body = JSON.parse(text)
    } catch {
      return new Response(
        JSON.stringify({
          error: 'validation_error',
          message: 'Invalid JSON in request body',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate batch
    const validation = validateBatch(body)
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({
          error: 'validation_error',
          message: 'Validation failed',
          details: validation.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const batch = validation.data

    // Cleanup old deduplication entries periodically (10% chance)
    if (Math.random() < 0.1) {
      await cleanupDeduplication(env.DB)
    }

    // Process events
    let inserted = 0
    let deduplicated = 0

    for (const event of batch.events) {
      try {
        // Check for duplicates
        const duplicate = await isDuplicate(env.DB, batch.client.client_id, event.id)
        if (duplicate) {
          deduplicated++
          continue
        }

        // Insert event
        await insertEvent(env.DB, batch, event)
        inserted++
      } catch (error) {
        console.error(`Failed to insert event ${event.id}:`, error)
        // Continue processing other events
      }
    }

    // Return 202 Accepted (no body per spec)
    return new Response(null, {
      status: 202,
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('Metrics error:', error)
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

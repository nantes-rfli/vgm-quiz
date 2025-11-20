import type { Env } from '../types/env'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEventOptions {
  event: string
  status?: 'start' | 'success' | 'fail' | string
  message?: string
  filtersKey?: string
  r2Key?: string
  durationMs?: number
  errorCode?: string
  fields?: Record<string, unknown>
  error?: unknown
}

export interface ObservabilityResult {
  payload: Record<string, unknown>
  sent: boolean
  destination?: 'slack'
  errorMessage?: string
}

export function isObservabilityEnabled(env: Env): boolean {
  return env.OBS_ENABLED === 'true' || env.OBS_ENABLED === '1'
}

export function logEvent(
  env: Env,
  level: LogLevel,
  options: LogEventOptions,
): Record<string, unknown> {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: env.OBS_SERVICE || 'workers',
    event: options.event,
    status: options.status,
    message: options.message,
    filtersKey: options.filtersKey,
    r2Key: options.r2Key,
    durationMs: options.durationMs,
    errorCode: options.errorCode,
    ...options.fields,
    error:
      options.error instanceof Error
        ? { message: options.error.message, stack: options.error.stack }
        : options.error,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  return payload
}

export async function sendSlackNotification(
  env: Env,
  text: string,
  fields?: Record<string, unknown>,
): Promise<ObservabilityResult> {
  if (!isObservabilityEnabled(env)) {
    return { payload: { text, fields }, sent: false, errorMessage: 'observability disabled' }
  }

  const webhook = env.OBS_SLACK_WEBHOOK_URL
  if (!webhook) {
    return { payload: { text, fields }, sent: false, errorMessage: 'webhook missing' }
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        attachments: fields
          ? [
              {
                color: '#7f5af0',
                fields: Object.entries(fields).map(([title, value]) => ({
                  title,
                  value: typeof value === 'string' ? value : JSON.stringify(value),
                  short: true,
                })),
                ts: Math.floor(Date.now() / 1000),
              },
            ]
          : undefined,
      }),
    })

    if (!res.ok) {
      return {
        payload: { text, fields },
        sent: false,
        destination: 'slack',
        errorMessage: `slack responded ${res.status}`,
      }
    }

    return { payload: { text, fields }, sent: true, destination: 'slack' }
  } catch (error) {
    console.warn('[observability] failed to send slack notification', error)
    return {
      payload: { text, fields },
      sent: false,
      destination: 'slack',
      errorMessage: error instanceof Error ? error.message : 'unknown error',
    }
  }
}

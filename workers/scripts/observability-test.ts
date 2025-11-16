import { logEvent, isObservabilityEnabled, sendSlackNotification } from '../shared/lib/observability'
import type { Env } from '../shared/types/env'

// Minimal env stub for local/CI dry-run. DB/STORAGE are not used here.
const env = {
  DB: {} as unknown as D1Database,
  STORAGE: {} as unknown as R2Bucket,
  JWT_SECRET: 'observability-test',
  OBS_ENABLED: process.env.OBS_ENABLED,
  OBS_SLACK_WEBHOOK_URL: process.env.OBS_SLACK_WEBHOOK_URL,
  OBS_SERVICE: process.env.OBS_SERVICE ?? 'observability-test',
} as Env

async function main() {
  const start = Date.now()
  const payload = logEvent(env, 'info', {
    event: 'observability.test',
    status: 'start',
    message: 'Observability dry-run payload',
    fields: {
      timestamp: new Date().toISOString(),
      service: env.OBS_SERVICE,
    },
  })

  if (!isObservabilityEnabled(env)) {
    console.log('[observability:test] OBS_ENABLED is not set to true; skipping remote send')
    return
  }

  const result = await sendSlackNotification(env, 'Observability test ping', {
    durationMs: Date.now() - start,
    payload,
  })

  logEvent(env, result.sent ? 'info' : 'warn', {
    event: 'observability.test.complete',
    status: result.sent ? 'success' : 'fail',
    message: result.sent ? 'Slack notification sent' : result.errorMessage,
    fields: { destination: result.destination },
  })
}

main().catch((error) => {
  logEvent(env, 'error', {
    event: 'observability.test.error',
    status: 'fail',
    error,
  })
  process.exitCode = 1
})

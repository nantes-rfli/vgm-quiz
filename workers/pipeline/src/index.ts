import { getTodayJST } from '../../shared/lib/date'
import {
  isObservabilityEnabled,
  logEvent,
  sendSlackNotification,
} from '../../shared/lib/observability'
import type { Env } from '../../shared/types/env'
import type { FilterOptions } from '../../shared/types/filters'
import { handleIntake } from './stages/intake'
import { handleDiscovery } from './stages/discovery'
import { handlePublish } from './stages/publish'

export default {
  /**
   * Scheduled event handler (Cron Triggers)
   * Runs daily at 00:00 JST (15:00 UTC)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const executionDate = getTodayJST()
    const startedAt = Date.now()
    logEvent(env, 'info', {
      event: 'cron.start',
      status: 'start',
      fields: {
        scheduledTime: new Date(event.scheduledTime).toISOString(),
        cron: event.cron,
        targetDateJst: executionDate,
      },
    })

    // Optional Phase 4A intake (external sources)
    const intakeResult = await handleIntake(env)
    if (!intakeResult.success) {
      const message = `Intake stage failed: ${intakeResult.errors.join(', ')}`
      logEvent(env, 'warn', {
        event: 'cron.intake',
        status: 'fail',
        message,
        fields: { errors: intakeResult.errors.slice(0, 5) },
      })
      await maybeNotifySlack(env, 'Cron intake failed (continuing discovery/publish)', {
        targetDate: executionDate,
        cron: event.cron,
        errors: intakeResult.errors.slice(0, 5).join('; '),
      })
      // continue to discovery/publish even if intake failed
    }

    // Run discovery first to sync latest curated.json
    logEvent(env, 'info', {
      event: 'cron.discovery',
      status: 'start',
    })
    const discoveryResult = await handleDiscovery(env)

    if (!discoveryResult.success) {
      const message = `Discovery stage failed: ${discoveryResult.errors.join(', ')}`
      logEvent(env, 'error', {
        event: 'cron.discovery',
        status: 'fail',
        message,
        fields: { errors: discoveryResult.errors },
      })
      await maybeNotifySlack(env, 'Cron discovery failed', {
        targetDate: executionDate,
        cron: event.cron,
        errors: discoveryResult.errors.slice(0, 5).join('; '),
      })
      throw new Error(message)
    }

    // Run publish to generate today's question set
    logEvent(env, 'info', {
      event: 'cron.publish',
      status: 'start',
    })
    const publishResult = await handlePublish(env, executionDate)

    if (publishResult.success) {
      if (publishResult.skipped) {
        logEvent(env, 'info', {
          event: 'cron.publish',
          status: 'success',
          message: 'Daily preset already exists, skipping generation',
          fields: {
            date: publishResult.date,
          },
        })
      } else {
        logEvent(env, 'info', {
          event: 'cron.publish',
          status: 'success',
          message: 'Daily preset generated',
          fields: {
            date: publishResult.date,
            questionsGenerated: publishResult.questionsGenerated,
            r2Key: publishResult.r2Key,
            hash: publishResult.hash,
          },
        })
      }
    } else {
      const message = `Publish stage failed: ${publishResult.error}`
      logEvent(env, 'error', {
        event: 'cron.publish',
        status: 'fail',
        message,
        fields: { date: publishResult.date },
      })
      await maybeNotifySlack(env, 'Cron publish failed', {
        targetDate: executionDate,
        cron: event.cron,
        error: publishResult.error,
      })
      throw new Error(message)
    }

    logEvent(env, 'info', {
      event: 'cron.end',
      status: 'success',
      durationMs: Date.now() - startedAt,
      fields: { targetDate: executionDate },
    })
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    try {
      // Discovery endpoint
      if (url.pathname === '/trigger/discovery' && request.method === 'POST') {
        const result = await handleDiscovery(env)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Intake endpoint (Phase 4A)
      if (url.pathname === '/trigger/intake' && request.method === 'POST') {
        const result = await handleIntake(env)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Publish endpoint
      if (url.pathname === '/trigger/publish' && request.method === 'POST') {
        const dateParam = url.searchParams.get('date')

        // Parse optional filter parameters
        const filters: FilterOptions = {}
        const difficulty = url.searchParams.get('difficulty')
        const era = url.searchParams.get('era')
        const seriesParam = url.searchParams.get('series')

        if (difficulty) filters.difficulty = difficulty
        if (era) filters.era = era
        if (seriesParam) {
          // Support comma-separated series tags: ?series=ff,dq,zelda
          filters.series = seriesParam
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        }

        const result = await handlePublish(
          env,
          dateParam,
          Object.keys(filters).length > 0 ? filters : undefined,
        )
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Not found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      logEvent(env, 'error', {
        event: 'fetch.handler',
        status: 'fail',
        message: 'Pipeline fetch failed',
        error,
      })
      return new Response(
        JSON.stringify({
          error: 'Internal error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  },
}

async function maybeNotifySlack(env: Env, title: string, fields: Record<string, unknown>) {
  if (!isObservabilityEnabled(env)) return
  await sendSlackNotification(env, `【vgm-quiz】${title}`, fields)
}

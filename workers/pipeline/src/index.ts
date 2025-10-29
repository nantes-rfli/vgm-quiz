import type { Env } from '../../shared/types/env'
import { handleDiscovery } from './stages/discovery'
import { type FilterOptions, handlePublish } from './stages/publish'

export default {
  /**
   * Scheduled event handler (Cron Triggers)
   * Runs daily at 00:00 JST (15:00 UTC)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Cron] START: Daily pipeline execution')
    console.log(`[Cron] Scheduled time: ${new Date(event.scheduledTime).toISOString()}`)
    console.log(`[Cron] Cron expression: ${event.cron}`)

    // Run discovery first to sync latest curated.json
    console.log('[Cron] Running discovery stage...')
    const discoveryResult = await handleDiscovery(env)

    if (!discoveryResult.success) {
      console.error('[Cron] Discovery stage failed, aborting pipeline')
      console.error(`[Cron] Discovery errors: ${discoveryResult.errors.join(', ')}`)
      throw new Error(`Discovery stage failed: ${discoveryResult.errors.join(', ')}`)
    }

    // Run publish to generate today's question set
    console.log('[Cron] Running publish stage...')
    const publishResult = await handlePublish(env, null) // null = today's date

    if (publishResult.success) {
      if (publishResult.skipped) {
        console.log('[Cron] SUCCESS: Pipeline completed (question set already exists, skipped)')
      } else {
        console.log('[Cron] SUCCESS: Pipeline completed successfully')
      }
    } else {
      console.error(`[Cron] FAILURE: Publish stage failed - ${publishResult.error}`)
      throw new Error(`Publish stage failed: ${publishResult.error}`)
    }
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
      console.error('Pipeline error:', error)
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

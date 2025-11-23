import type { Env } from '../../shared/types/env'
import { handleAvailabilityRequest } from './routes/availability'
import { handleDailyRequest } from './routes/daily'
import { handleManifestRequest } from './routes/manifest'
import { handleMetricsRequest } from './routes/metrics'
import { handleRoundsNext, handleRoundsStart } from './routes/rounds'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    }

    // Handle OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    try {
      // GET /daily
      if (url.pathname === '/daily' && request.method === 'GET') {
        return await handleDailyRequest(request, env)
      }

      // GET /v1/manifest
      if (url.pathname === '/v1/manifest' && request.method === 'GET') {
        return handleManifestRequest(env)
      }

      // POST /v1/rounds/start
      if (url.pathname === '/v1/rounds/start' && request.method === 'POST') {
        return await handleRoundsStart(request, env)
      }

      if (url.pathname === '/v1/rounds/start' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'method_not_allowed',
              message: 'Use POST /v1/rounds/start with a JSON body',
            },
          }),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', Allow: 'POST' },
          },
        )
      }

      // POST /v1/rounds/next
      if (url.pathname === '/v1/rounds/next' && request.method === 'POST') {
        return await handleRoundsNext(request, env)
      }

      // POST /v1/metrics
      if (url.pathname === '/v1/metrics' && request.method === 'POST') {
        return await handleMetricsRequest(request, env)
      }

      // POST /v1/availability
      if (url.pathname === '/v1/availability' && request.method === 'POST') {
        return await handleAvailabilityRequest(request, env)
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
      console.error('API error:', error)
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

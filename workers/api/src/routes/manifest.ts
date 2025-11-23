import { getManifest } from '../../../shared/data/manifest'
import type { Env } from '../../../shared/types/env'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export function handleManifestRequest(env: Env): Response {
  const manifest = getManifest(env)

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: JSON_HEADERS,
  })
}

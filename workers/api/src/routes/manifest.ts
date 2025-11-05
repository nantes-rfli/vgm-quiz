import { manifest } from '../../../shared/data/manifest'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export function handleManifestRequest(): Response {
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: JSON_HEADERS,
  })
}

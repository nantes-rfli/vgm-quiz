import type { Env } from '../types/env'
import type { Manifest } from '../types/manifest'

const BASE_MODE: Manifest['modes'][number] = {
  id: 'vgm_v1-ja',
  title: 'VGM Quiz Vol.1 (JA)',
  defaultTotal: 10,
  locale: 'ja',
}

const COMPOSER_MODE: Manifest['modes'][number] = {
  id: 'vgm_composer-ja',
  title: '作曲者モード (JA)',
  defaultTotal: 10,
  locale: 'ja',
}

const FACETS: Manifest['facets'] = {
  difficulty: ['easy', 'normal', 'hard', 'mixed'],
  era: ['80s', '90s', '00s', '10s', '20s', 'mixed'],
  series: ['ff', 'dq', 'zelda', 'mario', 'sonic', 'pokemon', 'mixed'],
}

function toBooleanFlag(value?: string): boolean {
  if (!value) return false
  const lowered = value.toLowerCase()
  return lowered === '1' || lowered === 'true' || lowered === 'on' || lowered === 'yes'
}

export function buildManifest(options: { composerModeEnabled?: boolean } = {}): Manifest {
  const composerModeEnabled = Boolean(options.composerModeEnabled)

  const modes: Manifest['modes'] = [BASE_MODE]
  if (composerModeEnabled) {
    modes.push(COMPOSER_MODE)
  }

  return {
    schema_version: 2,
    modes,
    facets: FACETS,
    features: {
      inlinePlaybackDefault: false,
      imageProxyEnabled: false,
      composerModeEnabled,
    },
  }
}

export function getManifest(env?: Pick<Env, 'COMPOSER_MODE_ENABLED'>): Manifest {
  const composerModeEnabled = toBooleanFlag(env?.COMPOSER_MODE_ENABLED)
  return buildManifest({ composerModeEnabled })
}

export function getDefaultMode(manifest: Manifest = buildManifest()): Manifest['modes'][number] {
  return manifest.modes[0]
}

export function findMode(modeId: string | undefined, manifest: Manifest = buildManifest()) {
  if (!modeId) {
    return getDefaultMode(manifest)
  }
  return manifest.modes.find((mode) => mode.id === modeId)
}

export function isValidFacetValue(
  facet: keyof Manifest['facets'],
  value: string,
  manifest: Manifest = buildManifest(),
): boolean {
  return manifest.facets[facet].includes(value)
}

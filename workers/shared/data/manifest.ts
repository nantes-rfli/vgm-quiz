import type { Manifest } from '../types/manifest'

export const manifest: Manifest = {
  schema_version: 2,
  modes: [
    {
      id: 'vgm_v1-ja',
      title: 'VGM Quiz Vol.1 (JA)',
      defaultTotal: 10,
      locale: 'ja',
    },
  ],
  facets: {
    difficulty: ['easy', 'normal', 'hard', 'mixed'],
    era: ['80s', '90s', '00s', '10s', '20s', 'mixed'],
    series: ['ff', 'dq', 'zelda', 'mario', 'sonic', 'pokemon', 'mixed'],
  },
  features: {
    inlinePlaybackDefault: false,
    imageProxyEnabled: false,
  },
}

export function getDefaultMode(): Manifest['modes'][number] {
  return manifest.modes[0]
}

export function isValidFacetValue(facet: keyof Manifest['facets'], value: string): boolean {
  return manifest.facets[facet].includes(value)
}

export interface ManifestMode {
  id: string
  title: string
  defaultTotal: number
  locale?: string
}

export interface ManifestFacets {
  difficulty: string[]
  era: string[]
  series: string[]
}

export interface ManifestFeatures {
  inlinePlaybackDefault: boolean
  imageProxyEnabled: boolean
}

export interface Manifest {
  schema_version: number
  modes: ManifestMode[]
  facets: ManifestFacets
  features: ManifestFeatures
}

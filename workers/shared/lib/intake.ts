export interface TrackMetaCandidate {
  title?: string
  game?: string
  composer?: string
  isrc?: string
  year?: number
  durationSec?: number
}

export interface AudioQualityMetrics {
  lufs?: number
  silenceRatio?: number
  clipRatio?: number
}

export interface GuardEvaluationInput {
  meta: TrackMetaCandidate
  audio?: AudioQualityMetrics
}

interface GuardThresholds {
  lufsMin: number
  lufsMax: number
  silenceMax: number
  clipMax: number
  durationMinSec: number
  durationMaxSec: number
}

export interface GuardEvaluationResult {
  pass: boolean
  reasons: string[]
  scores: {
    metadataCompleteness: number
    lufsOk: boolean
    silenceOk: boolean
    clipOk: boolean
    durationOk: boolean
  }
}

// Thresholds are centralized here for Phase 4A PoC.
export const GUARD_THRESHOLDS = {
  lufsMin: -22,
  lufsMax: -10,
  silenceMax: 0.03, // 3%
  clipMax: 0.001, // 0.1%
  durationMinSec: 30,
  durationMaxSec: 8 * 60,
}

/**
 * Compute metadata completeness score (0.0 - 1.0)
 * Required: title (+ game/composer 優先だがステージで調整可)
 * Optional but valuable: isrc, year
 */
export function computeMetadataCompleteness(meta: TrackMetaCandidate, required: Array<keyof TrackMetaCandidate> = ['title', 'game', 'composer']): {
  score: number
  missing: string[]
} {
  const optional: Array<keyof TrackMetaCandidate> = ['isrc', 'year']

  const missing = required.filter((field) => !meta[field])
  const optionalMissing = optional.filter((field) => !meta[field])

  const requiredScore = (required.length - missing.length) / required.length
  const optionalScore = (optional.length - optionalMissing.length) / optional.length

  const score = Math.round(((requiredScore * 0.8 + optionalScore * 0.2) + Number.EPSILON) * 100) / 100

  return { score, missing: [...missing, ...optionalMissing] }
}

/**
 * Evaluate guard checks using common thresholds.
 * Intended to be used before writing to R2/D1.
 */
export function evaluateGuard(
  input: GuardEvaluationInput,
  opts?: { stage?: string },
): GuardEvaluationResult {
  const { meta, audio } = input
  const isProd = opts?.stage && opts.stage.toLowerCase().startsWith('prod')

  const thresholds: GuardThresholds = isProd
    ? GUARD_THRESHOLDS
    : {
        ...GUARD_THRESHOLDS,
        durationMinSec: 10, // staging は短尺も許容
        durationMaxSec: 12 * 60, // staging は長尺を緩和
      }

  const requiredFields =
    isProd
      ? (['title', 'game', 'composer'] as Array<keyof TrackMetaCandidate>)
      : (['title'] as Array<keyof TrackMetaCandidate>) // staging 等では title さえあれば許容し、score 閾値を緩める

  const { score: metaScore, missing } = computeMetadataCompleteness(meta, requiredFields)

  const duration = meta.durationSec
  const durationOk =
    duration === undefined ||
    (duration >= thresholds.durationMinSec && duration <= thresholds.durationMaxSec)

  const lufsOk =
    audio?.lufs === undefined ||
    (audio.lufs >= thresholds.lufsMin && audio.lufs <= thresholds.lufsMax)

  const silenceOk = audio?.silenceRatio === undefined || audio.silenceRatio <= thresholds.silenceMax
  const clipOk = audio?.clipRatio === undefined || audio.clipRatio <= thresholds.clipMax

  const minMetaScore = opts?.stage && opts.stage.toLowerCase().startsWith('prod') ? 0.8 : 0.5

  const reasons: string[] = []
  if (metaScore < minMetaScore) reasons.push(`metadata completeness ${metaScore}`)
  if (missing.length) reasons.push(`missing: ${missing.join(',')}`)
  if (!durationOk) reasons.push('duration out of range')
  if (!lufsOk) reasons.push('lufs out of range')
  if (!silenceOk) reasons.push('silence ratio high')
  if (!clipOk) reasons.push('clipping ratio high')

  const pass =
    metaScore >= minMetaScore &&
    durationOk &&
    lufsOk &&
    silenceOk &&
    clipOk

  return {
    pass,
    reasons,
    scores: {
      metadataCompleteness: metaScore,
      lufsOk,
      silenceOk,
      clipOk,
      durationOk,
    },
  }
}

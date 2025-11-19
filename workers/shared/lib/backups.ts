import type { Env } from '../types/env'

export const DEFAULT_BACKUP_PREFIX = 'backups/daily'
export const DEFAULT_BACKUP_RETENTION_DAYS = 14
const DATE_CAPTURE_REGEX = /(\d{4}-\d{2}-\d{2})/

export function getBackupPrefix(env: Pick<Env, 'BACKUP_PREFIX'>): string {
  return normalizeBackupPrefix(env.BACKUP_PREFIX)
}

export function normalizeBackupPrefix(raw?: string): string {
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_BACKUP_PREFIX
  }
  return raw.trim().replace(/\/+$/, '')
}

export function getBackupRetentionDays(env: Pick<Env, 'BACKUP_EXPORT_DAYS'>): number {
  return normalizeRetentionDays(env.BACKUP_EXPORT_DAYS)
}

export function normalizeRetentionDays(raw?: string): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return DEFAULT_BACKUP_RETENTION_DAYS
}

export function buildBackupKey(prefix: string, canonicalKey: string): string | null {
  const sanitizedPrefix = prefix.replace(/\/+$/, '')
  const segments = canonicalKey.split('/')
  if (segments.length === 0) {
    return null
  }
  const fileName = segments[segments.length - 1]
  if (!fileName) {
    return null
  }
  return `${sanitizedPrefix}/${fileName}`
}

export function extractDateFromKey(key: string): string | null {
  const match = key.match(DATE_CAPTURE_REGEX)
  return match ? match[1] : null
}

export function parseDateFromKey(key: string): Date | null {
  const dateString = extractDateFromKey(key)
  if (!dateString) {
    return null
  }
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? null : date
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  encodeCopySource,
  enumerateDates,
  parseArgs,
  validateEnv,
} from '../scripts/export-snapshot'

describe('export snapshot helpers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('parseArgs handles ranges and flags', () => {
    const result = parseArgs([
      '--start',
      '2025-01-01',
      '--end',
      '2025-01-05',
      '--source',
      'backup',
      '--force',
    ])
    expect(result).toEqual({
      start: '2025-01-01',
      end: '2025-01-05',
      source: 'backup',
      force: true,
    })
  })

  it('enumerateDates throws when end precedes start', () => {
    expect(() => enumerateDates('2025-02-01', '2025-01-01')).toThrow(
      '--end must be greater than or equal to --start',
    )
  })

  it('encodeCopySource encodes reserved characters', () => {
    const output = encodeCopySource('vgm-quiz-storage', 'backups/daily/2025-01-01 copy.json')
    expect(output).toBe('vgm-quiz-storage/backups/daily/2025-01-01%20copy.json')
  })

  it('validateEnv requires D1 credentials when source is d1', () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc'
    process.env.CLOUDFLARE_D1_DATABASE_ID = 'db'
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.R2_ACCESS_KEY_ID = 'access'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET_NAME = 'vgm-quiz-storage'
    process.env.BACKUP_PREFIX = 'backups/daily'

    const config = validateEnv({
      start: '2025-01-01',
      end: '2025-01-01',
      source: 'd1',
      force: false,
    })
    expect(config.backupPrefix).toBe('backups/daily')
    expect(config.r2Endpoint).toContain('acc')
  })
})

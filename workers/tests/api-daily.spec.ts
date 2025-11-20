import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { describe, expect, it, vi } from 'vitest'
import { fetchBackupDaily } from '../api/src/lib/daily'
import { handleDailyRequest } from '../api/src/routes/daily'
import * as observability from '../shared/lib/observability'
import type { Env } from '../shared/types/env'
import { InMemoryR2Bucket } from './helpers/in-memory-r2'

class EmptyStatement {
  bind(): this {
    return this
  }

  async first<T>(): Promise<T | null> {
    return null
  }

  async all<T>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
    return { results: [], success: true, meta: {} }
  }

  async run(): Promise<{ results: unknown[]; success: boolean; meta: Record<string, unknown> }> {
    return { results: [], success: true, meta: {} }
  }
}

class EmptyD1Database {
  prepare(): EmptyStatement {
    return new EmptyStatement()
  }
}

describe('daily backup retrieval', () => {
  const baseExport = {
    meta: {
      date: '2025-01-01',
      version: '1.0.0',
      generated_at: '2025-01-01T00:00:00.000Z',
      hash: 'dummy-hash',
    },
    questions: [],
  }

  function createEnv(): Env {
    return {
      DB: new EmptyD1Database() as unknown as D1Database,
      STORAGE: new InMemoryR2Bucket() as unknown as R2Bucket,
      JWT_SECRET: 'test',
      BACKUP_PREFIX: 'backups/daily',
      BACKUP_EXPORT_DAYS: '14',
    }
  }

  it('fetchBackupDaily reads data from backup prefix when canonical export missing', async () => {
    const env = createEnv()
    await env.STORAGE.put('backups/daily/2025-01-01.json', JSON.stringify(baseExport))

    const result = await fetchBackupDaily(env, '2025-01-01')
    expect(result).toEqual(baseExport)
  })

  it('handleDailyRequest serves backup payload when backup=1 is requested', async () => {
    const env = createEnv()
    await env.STORAGE.put(
      'backups/daily/2025-01-02.json',
      JSON.stringify({
        ...baseExport,
        meta: { ...baseExport.meta, date: '2025-01-02', hash: 'hash-2' },
      }),
    )

    const request = new Request('https://example.com/daily?date=2025-01-02&backup=1', {
      method: 'GET',
    })

    const response = await handleDailyRequest(request, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-VGM-Daily-Source')).toBe('backup')

    const payload = await response.json()
    expect(payload.meta.date).toBe('2025-01-02')
    expect(payload.meta.hash).toBe('hash-2')
  })

  it('fetchBackupDaily falls back to legacy backup prefix when canonical payload is invalid', async () => {
    const env = createEnv()
    await env.STORAGE.put('backups/daily/2025-01-03.json', '{invalid-json')
    await env.STORAGE.put(
      'backups/2025-01-03.json',
      JSON.stringify({
        ...baseExport,
        meta: { ...baseExport.meta, date: '2025-01-03', hash: 'hash-legacy' },
      }),
    )

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await fetchBackupDaily(env, '2025-01-03')
    consoleSpy.mockRestore()

    expect(result?.meta.hash).toBe('hash-legacy')
  })

  it('handleDailyRequest logs warning when backup is requested but missing', async () => {
    const env = createEnv()
    const logSpy = vi.spyOn(observability, 'logEvent')

    const request = new Request('https://example.com/daily?date=2025-01-04&backup=1', {
      method: 'GET',
    })

    const response = await handleDailyRequest(request, env)
    expect(response.status).toBe(404)
    expect(logSpy).toHaveBeenCalledWith(
      env,
      'warn',
      expect.objectContaining({
        event: 'api.daily.backup',
        status: 'fail',
        fields: { date: '2025-01-04' },
      }),
    )

    logSpy.mockRestore()
  })
})

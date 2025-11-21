#!/usr/bin/env node
/**
 * Promote a staging export batch to production R2/D1.
 *
 * Prerequisites:
 * - R2 credentials: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * - Buckets: R2_SOURCE_BUCKET (staging), R2_TARGET_BUCKET (production)
 * - Optional: SOURCE_PREFIX (e.g. "staging"), TARGET_PREFIX (e.g. "")
 * - Date is required; batchId defaults to `${date}-<timestamp>`
 *
 * This script copies the export object, tags it with batchId metadata,
 * and writes a SQL file for D1 promotion / rollback.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { CopyObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { CANONICAL_FILTER_KEY, buildExportR2Key } from '../shared/lib/filters'

interface Args {
  date: string
  batchId: string
  filterKey: string
  dryRun: boolean
  sourcePrefix?: string
  targetPrefix?: string
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--date' || arg === '-d') {
      args.date = argv[++i]
    } else if (arg === '--batch' || arg === '-b') {
      args.batchId = argv[++i]
    } else if (arg === '--filter-key' || arg === '-f') {
      args.filterKey = argv[++i]
    } else if (arg === '--source-prefix') {
      args.sourcePrefix = argv[++i]
    } else if (arg === '--target-prefix') {
      args.targetPrefix = argv[++i]
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }

  if (!args.date) {
    throw new Error('Missing required --date (YYYY-MM-DD)')
  }

  return {
    date: args.date,
    batchId: args.batchId || `${args.date}-${Date.now()}`,
    filterKey: args.filterKey || CANONICAL_FILTER_KEY,
    dryRun: args.dryRun ?? false,
    sourcePrefix: args.sourcePrefix,
    targetPrefix: args.targetPrefix,
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function joinKey(prefix: string | undefined, key: string): string {
  if (!prefix) return key
  const p = prefix.replace(/\/+$/, '')
  return `${p}/${key}`
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

async function streamToString(body: unknown): Promise<string> {
  if (!body) return ''
  if (typeof body === 'string') return body
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf-8')
  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf-8')
  }
  const bodyMaybeTransform = body as {
    transformToByteArray?: () => Promise<Uint8Array> | Uint8Array
  }
  if (typeof bodyMaybeTransform.transformToByteArray === 'function') {
    const bytes = await bodyMaybeTransform.transformToByteArray()
    return Buffer.from(bytes).toString('utf-8')
  }
  return ''
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID')
  const sourceBucket = requireEnv('R2_SOURCE_BUCKET')
  const targetBucket = requireEnv('R2_TARGET_BUCKET')
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY')

  const baseKey = buildExportR2Key(args.date, args.filterKey)
  const sourceKey = joinKey(args.sourcePrefix || 'staging', baseKey)
  const targetKey = joinKey(args.targetPrefix, baseKey)

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })

  if (args.dryRun) {
    console.log(
      '[dry-run] would copy',
      `${sourceBucket}/${sourceKey}`,
      '->',
      `${targetBucket}/${targetKey}`,
    )
  } else {
    await s3.send(
      new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `/${sourceBucket}/${sourceKey}`,
        Key: targetKey,
        Metadata: { batchId: args.batchId },
        MetadataDirective: 'REPLACE',
        ContentType: 'application/json',
      }),
    )
    console.log('Copied R2 object with batchId metadata', { targetKey })
  }

  const object = await s3.send(
    new GetObjectCommand({
      Bucket: args.dryRun ? sourceBucket : targetBucket,
      Key: args.dryRun ? sourceKey : targetKey,
    }),
  )

  const body = await streamToString(object.Body)
  const parsed = JSON.parse(body) as {
    meta?: { hash?: string; version?: string }
  }
  const hash = parsed.meta?.hash || ''
  const version = parsed.meta?.version || '1.0.0'

  const sql = [
    '-- Auto-generated promotion script',
    'BEGIN TRANSACTION;',
    'CREATE TABLE IF NOT EXISTS promotion_batches (',
    '  batch_id TEXT PRIMARY KEY,',
    '  date TEXT NOT NULL,',
    '  r2_key TEXT NOT NULL,',
    '  filter_key TEXT NOT NULL,',
    "  created_at INTEGER DEFAULT (strftime('%s','now'))",
    ');',
    `INSERT OR REPLACE INTO promotion_batches (batch_id, date, r2_key, filter_key) VALUES ('${escapeSqlLiteral(args.batchId)}', '${escapeSqlLiteral(args.date)}', '${escapeSqlLiteral(targetKey)}', '${escapeSqlLiteral(args.filterKey)}');`,
    `INSERT OR REPLACE INTO picks (date, items, status, filters_json) VALUES ('${escapeSqlLiteral(args.date)}', '${escapeSqlLiteral(body)}', 'published', '${escapeSqlLiteral(args.filterKey)}');`,
    `INSERT OR REPLACE INTO exports (date, r2_key, version, hash, filters_json) VALUES ('${escapeSqlLiteral(args.date)}', '${escapeSqlLiteral(targetKey)}', '${escapeSqlLiteral(version)}', '${escapeSqlLiteral(hash)}', '${escapeSqlLiteral(args.filterKey)}');`,
    'COMMIT;',
    '',
    '-- Rollback template',
    `-- DELETE FROM exports WHERE date='${escapeSqlLiteral(args.date)}' AND filters_json='${escapeSqlLiteral(args.filterKey)}';`,
    `-- DELETE FROM picks WHERE date='${escapeSqlLiteral(args.date)}' AND filters_json='${escapeSqlLiteral(args.filterKey)}';`,
    `-- DELETE FROM promotion_batches WHERE batch_id='${escapeSqlLiteral(args.batchId)}';`,
    '',
  ].join('\n')

  const outDir = path.join(process.cwd(), 'tmp')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `batch-${args.batchId}.sql`)
  await writeFile(outPath, sql, 'utf8')

  console.log('Promotion SQL written to', outPath)
  console.log('Apply with: wrangler d1 execute <DB_NAME> --file', outPath)
  if (args.dryRun) {
    console.log('Note: dry-run only generated SQL; no R2 copy performed.')
  }
}

main().catch((err) => {
  console.error('[promote-batch] failed', err)
  process.exit(1)
})

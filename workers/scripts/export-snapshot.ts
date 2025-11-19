import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { buildBackupKey, normalizeBackupPrefix } from '../shared/lib/backups'
import { CANONICAL_FILTER_KEY, buildExportR2Key } from '../shared/lib/filters'

type SourceMode = 'd1' | 'backup'

export type CliOptions = {
  start: string
  end: string
  source: SourceMode
  force: boolean
}

type EnvConfig = {
  accountId: string
  d1DatabaseId: string
  apiToken: string
  r2AccessKeyId: string
  r2SecretKey: string
  r2Bucket: string
  r2Endpoint: string
  backupPrefix: string
}

interface D1StatementResult {
  results?: Array<Record<string, unknown>>
  success?: boolean
  meta?: Record<string, unknown>
}

interface D1RawResponse {
  result?: D1StatementResult[]
  success: boolean
  errors?: Array<{ message: string }>
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: Partial<CliOptions> = { source: 'd1', force: false }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--start' && argv[i + 1]) {
      opts.start = argv[++i]
    } else if (arg === '--end' && argv[i + 1]) {
      opts.end = argv[++i]
    } else if (arg === '--source' && argv[i + 1]) {
      const value = argv[++i]
      if (value !== 'd1' && value !== 'backup') {
        throw new Error(`Invalid --source value '${value}'. Use 'd1' or 'backup'.`)
      }
      opts.source = value
    } else if (arg === '--force') {
      opts.force = true
    } else if (arg === '--help') {
      printUsage()
      process.exit(0)
    }
  }

  if (!opts.start) {
    throw new Error('Missing required --start YYYY-MM-DD argument')
  }

  if (!opts.end) {
    opts.end = opts.start
  }

  return {
    start: opts.start,
    end: opts.end,
    source: opts.source as SourceMode,
    force: Boolean(opts.force),
  }
}

function printUsage(): void {
  console.log(
    'Usage: tsx scripts/export-snapshot.ts --start YYYY-MM-DD [--end YYYY-MM-DD] [--source d1|backup] [--force]\n',
  )
  console.log('Environment variables:')
  console.log('  CLOUDFLARE_ACCOUNT_ID         (required)')
  console.log('  CLOUDFLARE_D1_DATABASE_ID     (required for --source d1)')
  console.log('  CLOUDFLARE_API_TOKEN          (required for --source d1)')
  console.log('  R2_ACCESS_KEY_ID              (required)')
  console.log('  R2_SECRET_ACCESS_KEY          (required)')
  console.log('  R2_BUCKET_NAME                (required)')
  console.log('  BACKUP_PREFIX                 (optional, defaults to backups/daily)')
}

export function validateEnv(opts: CliOptions): EnvConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const d1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY
  const r2Bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET
  const backupPrefix = normalizeBackupPrefix(process.env.BACKUP_PREFIX)

  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is required')
  if (!r2AccessKeyId || !r2SecretKey) throw new Error('R2 access key/secret are required')
  if (!r2Bucket) throw new Error('R2_BUCKET_NAME (or R2_BUCKET) is required')

  if (opts.source === 'd1') {
    if (!d1DatabaseId) throw new Error('CLOUDFLARE_D1_DATABASE_ID is required for --source d1')
    if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is required for --source d1')
  }

  return {
    accountId,
    d1DatabaseId: d1DatabaseId || '',
    apiToken: apiToken || '',
    r2AccessKeyId,
    r2SecretKey,
    r2Bucket,
    r2Endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    backupPrefix,
  }
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date '${value}'. Expected YYYY-MM-DD format.`)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unable to parse date '${value}'`)
  }
  return date
}

export function enumerateDates(start: string, end: string): string[] {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (endDate < startDate) {
    throw new Error('--end must be greater than or equal to --start')
  }

  const dates: string[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().split('T')[0])
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

async function fetchFromD1(config: EnvConfig, date: string): Promise<string | null> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.d1DatabaseId}/raw`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT items FROM picks WHERE date = ? AND filters_json = ?',
        params: [date, '{}'],
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`D1 request failed (${response.status}): ${text}`)
  }

  const payload = (await response.json()) as D1RawResponse
  if (!payload.success) {
    const errorMessage = payload.errors?.map((err) => err.message).join(', ') || 'unknown D1 error'
    throw new Error(errorMessage)
  }

  const firstStatement = payload.result?.[0]
  const row = firstStatement?.results?.[0]
  const items = row?.items

  return typeof items === 'string' ? items : null
}

function createS3Client(config: EnvConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretKey,
    },
  })
}

async function objectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404) {
      return false
    }
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('Not Found') || message.includes('NoSuchKey')) {
      return false
    }
    throw error
  }
}

export function encodeCopySource(bucket: string, key: string): string {
  return `${bucket}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
}

async function copyFromBackup(
  client: S3Client,
  config: EnvConfig,
  date: string,
  targetKey: string,
): Promise<void> {
  const canonicalKey = buildExportR2Key(date, CANONICAL_FILTER_KEY)
  const backupKey = buildBackupKey(config.backupPrefix, canonicalKey)
  if (!backupKey) {
    throw new Error(`Unable to derive backup key for ${date}`)
  }

  await client.send(
    new CopyObjectCommand({
      Bucket: config.r2Bucket,
      Key: targetKey,
      CopySource: encodeCopySource(config.r2Bucket, backupKey),
      MetadataDirective: 'REPLACE',
      ContentType: 'application/json',
    }),
  )
}

async function putObject(
  client: S3Client,
  config: EnvConfig,
  targetKey: string,
  payload: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: targetKey,
      Body: payload,
      ContentType: 'application/json',
    }),
  )
}

async function processDate(
  client: S3Client,
  config: EnvConfig,
  date: string,
  opts: CliOptions,
): Promise<void> {
  const targetKey = buildExportR2Key(date, CANONICAL_FILTER_KEY)

  if (!opts.force && (await objectExists(client, config.r2Bucket, targetKey))) {
    console.log(`[skip] ${date} already exists at ${targetKey}`)
    return
  }

  if (opts.source === 'backup') {
    await copyFromBackup(client, config, date, targetKey)
    console.log(`[copy] ${date} ← backup (${config.backupPrefix}) → ${targetKey}`)
    return
  }

  const payload = await fetchFromD1(config, date)

  if (!payload) {
    console.warn(`[warn] No D1 export found for ${date}`)
    return
  }

  await putObject(client, config, targetKey, payload)
  console.log(`[put] ${date} written to ${targetKey}`)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const config = validateEnv(options)
  const dates = enumerateDates(options.start, options.end)
  const client = createS3Client(config)

  for (const date of dates) {
    try {
      await processDate(client, config, date, options)
    } catch (error) {
      console.error(`[error] ${date}:`, error)
      process.exitCode = 1
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[fatal] export-snapshot failed:', error)
    process.exit(1)
  })
}

export const __test__ = {
  parseArgs,
  enumerateDates,
  encodeCopySource,
  validateEnv,
}

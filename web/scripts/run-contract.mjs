#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

function run(command, args) {
  const result = spawnSync('npx', [command, ...args], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'test' },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function collectContractTests(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectContractTests(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.contract.spec.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDir)
const unitTestDir = join(projectRoot, 'tests', 'unit')

const unitContractTests = collectContractTests(unitTestDir).map((abs) =>
  relative(projectRoot, abs),
)

const argv = process.argv.slice(2)
let filter
let vitestOnly = false
let playwrightOnly = false
const passthrough = []

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '--filter' && argv[i + 1]) {
    filter = argv[i + 1]
    i += 1
  } else if (arg === '--vitest-only') {
    vitestOnly = true
  } else if (arg === '--pw-only') {
    playwrightOnly = true
  } else {
    passthrough.push(arg)
  }
}

if (playwrightOnly && vitestOnly) {
  console.error('Cannot combine --vitest-only and --pw-only')
  process.exit(1)
}

if (!playwrightOnly) {
  const vitestArgs = ['run', ...unitContractTests]
  if (filter) vitestArgs.push('--testNamePattern', filter)
  vitestArgs.push(...passthrough)
  run('vitest', vitestArgs)
}

if (!vitestOnly) {
  const playwrightArgs = ['test', '-c', 'playwright.contract.config.ts']
  if (filter) playwrightArgs.push('--grep', filter)
  playwrightArgs.push(...passthrough)
  run('playwright', playwrightArgs)
}

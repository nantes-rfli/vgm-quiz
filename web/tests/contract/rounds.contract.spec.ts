import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { Phase1NextResponseSchema, Phase1StartResponseSchema } from '@/src/features/quiz/api/schemas'

async function waitForMswReady(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
    timeout: 5000,
  })
}

async function attachJson(testInfo: TestInfo, name: string, data: unknown) {
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  })
}

test.describe('contract: rounds API', () => {
  test.beforeEach(async ({ page }) => {
    await waitForMswReady(page)
  })

  test('POST /v1/rounds/start responds with round + question payload', async ({ page }, testInfo) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/v1/rounds/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: 5,
          filters: { difficulty: ['normal'], era: ['90s'] },
        }),
      })
      const body = await res.json()
      return { status: res.status, body }
    })

    await attachJson(testInfo, 'rounds-start', response.body)

    expect(response.status).toBe(200)
    const parsed = Phase1StartResponseSchema.parse(response.body)
    expect(parsed.question.title).toBeTruthy()
    expect(parsed.choices.length).toBeGreaterThan(0)
    expect(parsed.round?.progress.total).toBeGreaterThan(0)
  })

  test('POST /v1/rounds/next emits reveal payload that matches schema', async ({ page }, testInfo) => {
    const start = await page.evaluate(async () => {
      const res = await fetch('/v1/rounds/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: 3 }),
      })
      const body = await res.json()
      return { status: res.status, body }
    })

    await attachJson(testInfo, 'rounds-start-for-next', start.body)
    expect(start.status).toBe(200)
    const parsedStart = Phase1StartResponseSchema.parse(start.body)

    const answer = parsedStart.choices[0]?.id ?? 'a'
    const next = await page.evaluate(async ({ token, answerId }) => {
      const res = await fetch('/v1/rounds/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ continuationToken: token, answer: answerId }),
      })
      const body = await res.json()
      return { status: res.status, body }
    }, { token: parsedStart.continuationToken, answerId: answer })

    await attachJson(testInfo, 'rounds-next', next.body)

    expect(next.status).toBe(200)
    const parsedNext = Phase1NextResponseSchema.parse(next.body)
    expect(parsedNext.result.reveal.title).toBeTruthy()
    expect(parsedNext.result.reveal.game).toBeTruthy()
  })
})

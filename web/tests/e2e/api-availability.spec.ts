import { test, expect } from '@playwright/test'

test.describe('API: /v1/availability endpoint', () => {
  // Note: These tests use MSW mocks defined in web/mocks/handlers.ts
  // The actual availability counting is mocked with reasonable values based on filter specificity

  test('returns available count for all tracks without filters', async ({ page }) => {
    // Navigate to page first to establish MSW context
    await page.goto('/play')

    // Use page.evaluate to call fetch within the MSW-intercepted context
    const result = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('available')
    expect(typeof result.body.available).toBe('number')
    expect(result.body.available).toBeGreaterThan(0)
  })

  test('returns error when mode is missing', async ({ page }) => {
    await page.goto('/play')

    const result = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: { difficulty: 'easy' },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty('error')
    expect(result.body.error.code).toBe('bad_request')
    expect(result.body.error.message).toContain('mode')
  })

  test('returns reduced count with difficulty filter', async ({ page }) => {
    await page.goto('/play')

    // Get baseline count without filters
    const baselineResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })
    const baselineCount = baselineResult.body.available

    // Get count with difficulty filter
    const filteredResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
          filters: {
            difficulty: 'easy',
          },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(filteredResult.status).toBe(200)
    expect(filteredResult.body).toHaveProperty('available')
    expect(typeof filteredResult.body.available).toBe('number')
    expect(filteredResult.body.available).toBeLessThanOrEqual(baselineCount)
  })

  test('returns reduced count with era filter', async ({ page }) => {
    await page.goto('/play')

    // Get baseline count without filters
    const baselineResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })
    const baselineCount = baselineResult.body.available

    // Get count with era filter
    const filteredResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
          filters: {
            era: '90s',
          },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(filteredResult.status).toBe(200)
    expect(filteredResult.body).toHaveProperty('available')
    expect(typeof filteredResult.body.available).toBe('number')
    expect(filteredResult.body.available).toBeLessThanOrEqual(baselineCount)
  })

  test('returns reduced count with series filter', async ({ page }) => {
    await page.goto('/play')

    // Get baseline count without filters
    const baselineResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })
    const baselineCount = baselineResult.body.available

    // Get count with series filter
    const filteredResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
          filters: {
            series: ['ff', 'zelda'],
          },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(filteredResult.status).toBe(200)
    expect(filteredResult.body).toHaveProperty('available')
    expect(typeof filteredResult.body.available).toBe('number')
    expect(filteredResult.body.available).toBeLessThan(baselineCount)
  })

  test('returns count with multiple filters combined', async ({ page }) => {
    await page.goto('/play')

    const result = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
          filters: {
            difficulty: 'hard',
            era: '00s',
            series: ['ff'],
          },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('available')
    expect(typeof result.body.available).toBe('number')
    expect(result.body.available).toBeGreaterThanOrEqual(0)
  })

  test('handles mixed filter value (should return higher count)', async ({ page }) => {
    await page.goto('/play')

    // Get count with mixed filters
    const mixedResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
          filters: {
            difficulty: 'mixed',
            era: 'mixed',
          },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    expect(mixedResult.status).toBe(200)
    expect(mixedResult.body).toHaveProperty('available')

    // Get count with specific filter
    const specificResult = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
          filters: {
            difficulty: 'easy',
          },
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    // With "mixed" filters, should get higher or equal count
    expect(mixedResult.body.available).toBeGreaterThanOrEqual(specificResult.body.available)
  })

  test('returns valid JSON response with proper error structure on server error', async ({
    page,
  }) => {
    await page.goto('/play')

    // This test checks response format compliance
    const result = await page.evaluate(async () => {
      const response = await fetch('/v1/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vgm_v1-ja',
        }),
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    })

    // Successful responses should have 'available' field
    if (result.status === 200) {
      expect(result.body).toHaveProperty('available')
    } else {
      // Error responses should have 'error' field with code and message
      expect(result.body).toHaveProperty('error')
      expect(result.body.error).toHaveProperty('code')
      expect(result.body.error).toHaveProperty('message')
    }
  })
})

import { test, expect, type Page } from '@playwright/test';
import { ANSWERS } from '../../mocks/fixtures/rounds/answers';

const QUESTION_IDS = Object.keys(ANSWERS).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true })
);

function waitForQuestion(page: Page, index: number) {
  const questionPrompt = page.getByTestId('question-prompt');
  const timeout = index === 0 ? 60_000 : 15_000;
  return expect(questionPrompt).toBeVisible({ timeout });
}

test.describe('Play page features', () => {
  test('inline playback toggle persists across reload', async ({ page }) => {
    await page.goto('/play');

    const toggle = page.getByRole('button', { name: 'Inline playback' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByTestId('question-prompt')).toBeVisible({ timeout: 60_000 });

    const toggleAfterReload = page.getByRole('button', { name: 'Inline playback' });
    await expect(toggleAfterReload).toHaveAttribute('aria-pressed', 'true');
  });

  test('reveal view exposes external link metadata', async ({ page }) => {
    await page.goto('/play');

    await waitForQuestion(page, 0);

    const firstQuestionId = QUESTION_IDS[0];
    const correctChoice = ANSWERS[firstQuestionId];

    await page.getByTestId(`choice-${correctChoice}`).click();
    const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    const revealHeading = page.getByRole('heading', { name: 'Listen / Watch' });
    await expect(revealHeading).toBeVisible();

    const externalLink = page.getByRole('link', { name: /Open in/i });
    await expect(externalLink).toHaveAttribute('target', '_blank');
    await expect(externalLink).toHaveAttribute('rel', /noopener/);
    await expect(page.getByText('Work:')).toBeVisible();
    await expect(page.getByText('Composer:')).toBeVisible();
  });

  test('result summary reflects mixed outcomes', async ({ page }) => {
    await page.goto('/play');

    for (const [index, questionId] of QUESTION_IDS.entries()) {
      await waitForQuestion(page, index);
      const correctChoice = ANSWERS[questionId];
      const selectedChoice = index === 0 ? (correctChoice === 'a' ? 'b' : 'a') : correctChoice;

      await page.getByTestId(`choice-${selectedChoice}`).click();
      const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      await expect(page.getByRole('heading', { name: 'Listen / Watch' })).toBeVisible();
      await page.getByTestId('reveal-next').click();
    }

    await page.waitForURL('**/result');
    await expect(page).toHaveURL(/\/result$/);

    await expect(page.getByText('✕ 1', { exact: true })).toBeVisible();
    await expect(page.getByText('✓ 9', { exact: true })).toBeVisible();
    await expect(page.getByText(/Answered: 10/)).toBeVisible();

    const firstCard = page.locator('li', { hasText: '#1 — このBGMの作曲者は？' }).first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.getByText('Wrong')).toBeVisible();
  });

  test('handles question timeout and missing reveal links', async ({ page }) => {
    await page.addInitScript(() => {
      const anyWindow = window as unknown as { __ORIGINAL_FETCH__?: typeof fetch };
      if (!anyWindow.__ORIGINAL_FETCH__) {
        anyWindow.__ORIGINAL_FETCH__ = window.fetch;
      }
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const request = args[0];
          const url = typeof request === 'string' ? request : request.url;
          if (url.includes('/v1/rounds/start')) {
            const clone = response.clone();
            const data = await clone.json();
            if (data?.question?.reveal?.links?.length) {
              data.question.reveal.links = [];
              const headers = new Headers(response.headers);
              headers.set('content-type', 'application/json');
              return new Response(JSON.stringify(data), {
                status: response.status,
                statusText: response.statusText,
                headers,
              });
            }
          }
        } catch {
          // fall through and use original response
        }
        return response;
      };
    });

    await page.goto('/play');
    await waitForQuestion(page, 0);

    await page.waitForTimeout(16_000);
    await expect(page.getByText('Timeout')).toBeVisible();
    await expect(page.getByText('? 1', { exact: true })).toBeVisible();
    await expect(page.getByText(/No links available/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Open in/i })).toHaveCount(0);

    await page.getByTestId('reveal-next').click();

    for (const [loopIndex, questionId] of QUESTION_IDS.entries()) {
      if (loopIndex === 0) continue;
      await waitForQuestion(page, loopIndex);
      const choiceId = ANSWERS[questionId];
      await page.getByTestId(`choice-${choiceId}`).click();
      const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();
      await expect(page.getByRole('heading', { name: 'Listen / Watch' })).toBeVisible();
      await page.getByTestId('reveal-next').click();
    }

    await page.waitForURL('**/result');
    await expect(page.getByText('? 1', { exact: true })).toBeVisible();

    const timeoutCard = page.locator('li', { hasText: '#1 — このBGMの作曲者は？' }).first();
    await expect(timeoutCard.getByText('Timeout')).toBeVisible();
    await expect(timeoutCard.getByText('Your answer: —')).toBeVisible();

    await page.evaluate(() => {
      const anyWindow = window as unknown as { __ORIGINAL_FETCH__?: typeof fetch };
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
    });
  });

  test('handles unsupported reveal providers', async ({ page }) => {
    await page.addInitScript(() => {
      const anyWindow = window as unknown as { __ORIGINAL_FETCH__?: typeof fetch };
      if (!anyWindow.__ORIGINAL_FETCH__) {
        anyWindow.__ORIGINAL_FETCH__ = window.fetch;
      }
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const request = args[0];
          const url = typeof request === 'string' ? request : request.url;
          if (url.includes('/v1/rounds/start')) {
            const data = await response.clone().json();
            if (data?.question?.reveal) {
              data.question.reveal.links = [
                { provider: 'unknown', url: 'notaurl' } as { provider: string; url: string },
              ];
              const headers = new Headers(response.headers);
              headers.set('content-type', 'application/json');
              return new Response(JSON.stringify(data), {
                status: response.status,
                statusText: response.statusText,
                headers,
              });
            }
          }
        } catch {
          // fall through
        }
        return response;
      };
    });

    await page.goto('/play');
    await waitForQuestion(page, 0);

    const firstQuestionId = QUESTION_IDS[0];
    const correctChoice = ANSWERS[firstQuestionId];
    await page.getByTestId(`choice-${correctChoice}`).click();
    const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    const fallbackLink = page.getByRole('link', { name: /Open in unknown/i });
    await expect(fallbackLink).toBeVisible();
    await expect(fallbackLink).toHaveAttribute('href', 'notaurl');
    await expect(page.locator('iframe[title="Player"]')).toHaveCount(0);

    await page.evaluate(() => {
      const anyWindow = window as unknown as { __ORIGINAL_FETCH__?: typeof fetch };
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
    });
  });

  test('records metrics events for toggle and reveal interactions', async ({ page, context }) => {
    await context.route('https://www.youtube.com/**', (route) => route.abort());

    await page.addInitScript(() => {
      const anyWindow = window as unknown as { __ORIGINAL_FETCH__?: typeof fetch };
      if (!anyWindow.__ORIGINAL_FETCH__) {
        anyWindow.__ORIGINAL_FETCH__ = window.fetch;
      }
      const batches: Array<{ events?: Array<{ name: string; attrs?: Record<string, unknown> }> }> = [];
      const originalFetch = window.fetch;

      window.__METRICS_LOG__ = batches;

      window.fetch = async (...args) => {
        const request = typeof args[0] === 'string' ? new Request(args[0], args[1]) : args[0];
        if (request.url.includes('/v1/metrics')) {
          try {
            const clone = request.clone();
            const text = await clone.text();
            batches.push(JSON.parse(text));
          } catch {
            batches.push({});
          }
          // Forward the request using the cloned Request to preserve body
          return originalFetch(request);
        }
        return originalFetch(args[0], args[1]);
      };

      // Prevent target="_blank" navigation from leaving the page
      window.addEventListener(
        'click',
        (event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('a[target="_blank"]')) {
            event.preventDefault();
          }
        },
        true
      );
    });

    await page.goto('/play');
    await waitForQuestion(page, 0);

    const toggle = page.getByRole('button', { name: 'Inline playback' });
    await toggle.click();

    const correctChoice = ANSWERS[QUESTION_IDS[0]];
    await page.getByTestId(`choice-${correctChoice}`).click();
    const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    const revealLink = page.getByRole('link', { name: /Open in/i });
    await revealLink.click();

    await page.waitForFunction(() => {
      const batches = (window as unknown as { __METRICS_LOG__?: Array<{ events?: Array<{ name: string }> }> })
        .__METRICS_LOG__;
      if (!batches) return false;
      return batches.flatMap((batch) => batch.events ?? []).length >= 3;
    }, { timeout: 15_000 });

    const metricEvents = await page.evaluate(() => {
      const batches = (window as unknown as { __METRICS_LOG__?: Array<{ events?: Array<{ name: string; attrs?: Record<string, unknown> }> }> })
        .__METRICS_LOG__;
      if (!batches) return [];
      return batches.flatMap((batch) => batch.events ?? []);
    });

    const names = new Set(metricEvents.map((event) => event.name));
    expect(names).toContain('settings_inline_toggle');
    expect(names).toContain('answer_result');
    expect(names).toContain('reveal_open_external');

    const answerResult = metricEvents.find((event) => event.name === 'answer_result');
    expect(answerResult?.attrs).toMatchObject({ outcome: 'correct', questionId: QUESTION_IDS[0] });

    await page.evaluate(() => {
      const anyWindow = window as unknown as { __ORIGINAL_FETCH__?: typeof fetch };
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
    });
  });

  test('retries metrics flush after 429 responses', async ({ page }) => {
    await page.addInitScript(() => {
      const anyWindow = window as unknown as {
        __OVERRIDE_READY__?: boolean;
        __ORIGINAL_FETCH__?: typeof fetch;
        __ORIGINAL_SET_TIMEOUT__?: typeof window.setTimeout;
        __METRICS_LOG__?: Array<{ events?: Array<{ name: string; attrs?: Record<string, unknown> }> }>;
        __METRICS_ATTEMPTS__?: number;
      };

      const applyOverride = () => {
        if (anyWindow.__OVERRIDE_READY__) return;
        anyWindow.__OVERRIDE_READY__ = true;

        if (!anyWindow.__ORIGINAL_FETCH__) {
          anyWindow.__ORIGINAL_FETCH__ = window.fetch;
        }
        if (!anyWindow.__ORIGINAL_SET_TIMEOUT__) {
          anyWindow.__ORIGINAL_SET_TIMEOUT__ = window.setTimeout;
        }

        const originalFetch = window.fetch;
        const originalSetTimeout = window.setTimeout;

        anyWindow.__METRICS_LOG__ = [];
        anyWindow.__METRICS_ATTEMPTS__ = 0;

        window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
          originalSetTimeout(handler, timeout && timeout > 50 ? 50 : timeout ?? 0, ...rest)) as typeof window.setTimeout;

        window.fetch = async (...args) => {
          const request = typeof args[0] === 'string' ? new Request(args[0], args[1]) : args[0];
          if (request.url.includes('/v1/metrics')) {
            try {
              const text = await request.clone().text();
              anyWindow.__METRICS_LOG__!.push(JSON.parse(text));
            } catch {
              anyWindow.__METRICS_LOG__!.push({});
            }
            const attempt = (anyWindow.__METRICS_ATTEMPTS__ = (anyWindow.__METRICS_ATTEMPTS__ ?? 0) + 1);
            if (attempt === 1) {
              return new Response('', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '0' } });
            }
            return new Response('', { status: 202, statusText: 'Accepted' });
          }
          return originalFetch(args[0], args[1]);
        };
      };

      if (navigator.serviceWorker?.controller) {
        applyOverride();
      } else {
        navigator.serviceWorker?.ready.then(applyOverride);
      }
    });

    await page.goto('/play');
    await waitForQuestion(page, 0);

    const toggle = page.getByRole('button', { name: 'Inline playback' });
    await toggle.click();
    const correctChoice = ANSWERS[QUESTION_IDS[0]];
    await page.getByTestId(`choice-${correctChoice}`).click();
    const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await page.waitForFunction(() => {
      const anyWindow = window as unknown as { __METRICS_ATTEMPTS__?: number };
      return (anyWindow.__METRICS_ATTEMPTS__ ?? 0) >= 2;
    }, { timeout: 15_000 });

    const result = await page.evaluate(() => {
      const anyWindow = window as unknown as {
        __METRICS_ATTEMPTS__?: number;
        __METRICS_LOG__?: Array<{ events?: Array<{ name: string; attrs?: Record<string, unknown> }> }>;
        __ORIGINAL_FETCH__?: typeof fetch;
        __ORIGINAL_SET_TIMEOUT__?: typeof window.setTimeout;
      };
      const output = {
        attempts: anyWindow.__METRICS_ATTEMPTS__ ?? 0,
        events: (anyWindow.__METRICS_LOG__ ?? []).flatMap((batch) => batch.events ?? []),
      };
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
      if (anyWindow.__ORIGINAL_SET_TIMEOUT__) {
        window.setTimeout = anyWindow.__ORIGINAL_SET_TIMEOUT__;
        delete anyWindow.__ORIGINAL_SET_TIMEOUT__;
      }
      delete anyWindow.__METRICS_LOG__;
      delete anyWindow.__METRICS_ATTEMPTS__;
      delete anyWindow.__OVERRIDE_READY__;
      return output;
    });

    expect(result.attempts).toBeGreaterThanOrEqual(2);
    expect(result.events.some((event) => event.name === 'answer_result')).toBe(true);
  });

  test('resends metrics after network failures', async ({ page }) => {
    await page.addInitScript(() => {
      const anyWindow = window as unknown as {
        __OVERRIDE_READY__?: boolean;
        __ORIGINAL_FETCH__?: typeof fetch;
        __ORIGINAL_SET_TIMEOUT__?: typeof window.setTimeout;
        __METRICS_LOG__?: Array<{ events?: Array<{ name: string; attrs?: Record<string, unknown> }> }>;
        __METRICS_ATTEMPTS__?: number;
      };

      const applyOverride = () => {
        if (anyWindow.__OVERRIDE_READY__) return;
        anyWindow.__OVERRIDE_READY__ = true;

        if (!anyWindow.__ORIGINAL_FETCH__) {
          anyWindow.__ORIGINAL_FETCH__ = window.fetch;
        }
        if (!anyWindow.__ORIGINAL_SET_TIMEOUT__) {
          anyWindow.__ORIGINAL_SET_TIMEOUT__ = window.setTimeout;
        }

        const originalFetch = window.fetch;
        const originalSetTimeout = window.setTimeout;

        anyWindow.__METRICS_LOG__ = [];
        anyWindow.__METRICS_ATTEMPTS__ = 0;

        window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
          originalSetTimeout(handler, timeout && timeout > 50 ? 50 : timeout ?? 0, ...rest)) as typeof window.setTimeout;

        window.fetch = async (...args) => {
          const request = typeof args[0] === 'string' ? new Request(args[0], args[1]) : args[0];
          if (request.url.includes('/v1/metrics')) {
            let payload: unknown = {};
            try {
              const text = await request.clone().text();
              payload = JSON.parse(text);
            } catch {
              payload = {};
            }
            anyWindow.__METRICS_LOG__!.push(payload as { events?: Array<{ name: string; attrs?: Record<string, unknown> }> });

            const attempt = (anyWindow.__METRICS_ATTEMPTS__ = (anyWindow.__METRICS_ATTEMPTS__ ?? 0) + 1);
            if (attempt <= 2) {
              throw new TypeError('Network disconnected');
            }
            return new Response('', { status: 202, statusText: 'Accepted' });
          }
          return originalFetch(args[0], args[1]);
        };
      };

      if (navigator.serviceWorker?.controller) {
        applyOverride();
      } else {
        navigator.serviceWorker?.ready.then(applyOverride);
      }
    });

    await page.goto('/play');
    await waitForQuestion(page, 0);

    const toggle = page.getByRole('button', { name: 'Inline playback' });
    await toggle.click();
    const correctChoice = ANSWERS[QUESTION_IDS[0]];
    await page.getByTestId(`choice-${correctChoice}`).click();
    const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await page.waitForFunction(() => {
      const anyWindow = window as unknown as { __METRICS_ATTEMPTS__?: number };
      return (anyWindow.__METRICS_ATTEMPTS__ ?? 0) >= 3;
    }, { timeout: 15_000 });

    await page.waitForFunction(() => {
      const anyWindow = window as unknown as { __METRICS_LOG__?: Array<{ events?: Array<{ name: string }> }> };
      const events = anyWindow.__METRICS_LOG__?.flatMap((batch) => batch.events ?? []) ?? [];
      return events.length >= 1;
    }, { timeout: 15_000 });

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('vgm2.metrics.queue'));
      return raw;
    }).toBeNull();

    const result = await page.evaluate(() => {
      const anyWindow = window as unknown as {
        __METRICS_ATTEMPTS__?: number;
        __METRICS_LOG__?: Array<{ events?: Array<{ name: string; attrs?: Record<string, unknown> }> }>;
        __ORIGINAL_FETCH__?: typeof fetch;
        __ORIGINAL_SET_TIMEOUT__?: typeof window.setTimeout;
        __OVERRIDE_READY__?: boolean;
      };
      const output = {
        attempts: anyWindow.__METRICS_ATTEMPTS__ ?? 0,
        events: (anyWindow.__METRICS_LOG__ ?? []).flatMap((batch) => batch.events ?? []),
      };
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
      if (anyWindow.__ORIGINAL_SET_TIMEOUT__) {
        window.setTimeout = anyWindow.__ORIGINAL_SET_TIMEOUT__;
        delete anyWindow.__ORIGINAL_SET_TIMEOUT__;
      }
      delete anyWindow.__METRICS_LOG__;
      delete anyWindow.__METRICS_ATTEMPTS__;
      delete anyWindow.__OVERRIDE_READY__;
      return output;
    });

    expect(result.attempts).toBeGreaterThanOrEqual(3);
    expect(result.events.some((event) => event.name === 'answer_result')).toBe(true);
  });
});

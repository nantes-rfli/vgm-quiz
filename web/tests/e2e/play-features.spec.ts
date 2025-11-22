import { test, expect, type Page, type Request as PlaywrightRequest } from '@playwright/test';
import { ANSWERS } from '../../mocks/fixtures/rounds/answers';

type MetricsEvent = { name: string; attrs?: Record<string, unknown> };
type MetricsBatch = { events?: MetricsEvent[] };
type InstrumentedWindow = Window & {
  __ORIGINAL_FETCH__?: typeof fetch;
  __ORIGINAL_SET_TIMEOUT__?: typeof window.setTimeout;
  __METRICS_LOG__?: MetricsBatch[];
  __METRICS_ATTEMPTS__?: number;
  __OVERRIDE_READY__?: boolean;
};

type StartRequestPayload = {
  mode?: string;
  total?: number;
  seed?: string;
  filters?: {
    difficulty?: string[];
    era?: string[];
    series?: string[];
  };
};

const QUESTION_IDS = Object.keys(ANSWERS).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true })
);

async function waitForQuestion(page: Page, index: number) {
  const questionPrompt = page.getByTestId('question-prompt');
  const retryButton = page.getByRole('button', { name: /Retry/i });
  const expectedId = QUESTION_IDS[index];
  const timeout = index === 0 ? 60_000 : 15_000;
  const deadline = Date.now() + timeout;

  if (index === 0) {
    const filterTitle = page.getByTestId('filter-selector-title');
    const filterVisible = await filterTitle.isVisible({ timeout: 1000 }).catch(() => false);
    if (filterVisible) {
      const startButton = page.getByTestId('filter-start-button');
      await startButton.waitFor({ state: 'visible', timeout: 10_000 });
      await expect(startButton).toBeEnabled({ timeout: 10_000 });
      await startButton.click();
    }
  } else {
    const ctaStartButton = page.getByRole('button', { name: /Start/i }).first();
    const ctaVisible = await ctaStartButton.isVisible({ timeout: 500 }).catch(() => false);
    if (ctaVisible) {
      await expect(ctaStartButton).toBeEnabled({ timeout: 5_000 });
      await ctaStartButton.click();
    }
  }

  while (Date.now() < deadline) {
    try {
      await questionPrompt.waitFor({ state: 'visible', timeout: 500 });
      const attr = await questionPrompt.getAttribute('data-question-id');
      if (attr === expectedId) return;
    } catch {
      // ignore
    }

    if (await retryButton.isVisible({ timeout: 100 }).catch(() => false)) {
      await retryButton.click();
    }
  }

  await expect(questionPrompt).toHaveAttribute('data-question-id', expectedId, { timeout: 1000 });
}

function parseStartRequest(request: PlaywrightRequest): StartRequestPayload {
  const rawBody = request.postData();
  return rawBody ? (JSON.parse(rawBody) as StartRequestPayload) : {};
}

async function waitForStartRequest(page: Page, trigger: () => Promise<void>) {
  const requestPromise = page.waitForRequest((request) =>
    request.url().includes('/v1/rounds/start') && request.method() === 'POST'
  );
  await trigger();
  return requestPromise;
}

async function ensureFilterVisibleAndStart(page: Page) {
  const filterTitle = page.getByTestId('filter-selector-title');
  const filterVisible = await filterTitle.isVisible({ timeout: 1000 }).catch(() => false);
  if (!filterVisible) return false;
  const startButton = page.getByTestId('filter-start-button');
  await startButton.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();
  return true;
}

async function completeQuizAndNavigateToResult(page: Page) {
  const maxQuestions = 20;
  for (let i = 0; i < maxQuestions; i += 1) {
    await page.getByTestId('question-prompt').waitFor({ timeout: 60_000 });
    const choiceButtons = page.locator('[data-testid^="choice-"]');
    await choiceButtons.first().click();
    const answerButton = page.locator('button:has-text("(Enter)")').first();
    await answerButton.click();
    const revealNext = page.getByTestId('reveal-next');
    await expect(revealNext).toBeVisible({ timeout: 10_000 });
    await revealNext.click();

    const reachedResult = await Promise.race([
      page.waitForURL('**/result', { timeout: 5_000 }).then(() => true).catch(() => false),
      page.waitForSelector('[data-testid="question-prompt"]', { timeout: 5_000, state: 'visible' }).then(() => false).catch(() => false),
    ]);

    if (reachedResult) {
      await page.waitForURL('**/result', { timeout: 30_000 });
      return;
    }
  }
  throw new Error('Result page was not reached within the expected number of questions');
}

async function enableStartErrorInterceptor(page: Page) {
  await page.addInitScript(() => {
    const anyWindow = window as unknown as {
      __VGQ_FETCH_PATCHED__?: boolean;
      __VGQ_FORCE_START_ERROR__?: string | null;
    } & typeof window;

    if (anyWindow.__VGQ_FETCH_PATCHED__) return;
    anyWindow.__VGQ_FETCH_PATCHED__ = true;
    anyWindow.__VGQ_FORCE_START_ERROR__ = null;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const [resource] = args;
      const url =
        typeof resource === 'string'
          ? resource
          : resource instanceof Request
            ? resource.url
            : resource instanceof URL
              ? resource.toString()
              : '';
      const forceError = anyWindow.__VGQ_FORCE_START_ERROR__;
      if (forceError && url?.includes('/v1/rounds/start')) {
        anyWindow.__VGQ_FORCE_START_ERROR__ = null;
        if (forceError === 'no_questions') {
          return new Response(
            JSON.stringify({
              error: 'no_questions',
              message: 'No questions available for the selected filters',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }
      return originalFetch(...args);
    };
  });
}

test.describe('Play page features', () => {

  test('composer mode selection sends mode param and shows composer prompt', async ({ page }) => {
    await page.goto('/play');

    // Select composer mode if mode selector is present
    const modeRadio = page.getByTestId('mode-vgm_composer-ja');
    const hasModeSelector = await modeRadio.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasModeSelector) {
      await modeRadio.check();
    }

    const request = await waitForStartRequest(page, async () => {
      const started = await ensureFilterVisibleAndStart(page);
      if (!started) {
        // fallback: click CTA Start if filter not visible
        const ctaStart = page.getByRole('button', { name: /Start/i }).first();
        await expect(ctaStart).toBeEnabled({ timeout: 5_000 });
        await ctaStart.click();
      }
    });

    const payload = parseStartRequest(request);
    if (hasModeSelector) {
      expect(payload.mode).toBe('vgm_composer-ja');
    }

    await page.getByTestId('question-prompt').waitFor({ timeout: 60_000 });
    const promptText = await page.getByTestId('question-prompt').innerText();
    expect(promptText).toContain('作曲者');
  });

  test('inline playback toggle persists across reload', async ({ page }) => {
    await page.goto('/play?autostart=1');

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
    // Phase 1: Intercept /v1/rounds/next to remove youtube_url/spotify_url from first question's reveal
    await page.addInitScript(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      if (!anyWindow.__ORIGINAL_FETCH__) {
        anyWindow.__ORIGINAL_FETCH__ = window.fetch;
      }
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const requestInput = args[0];
          const url =
            typeof requestInput === 'string'
              ? requestInput
              : requestInput instanceof URL
                ? requestInput.toString()
                : requestInput.url;
          // Phase 1: reveal comes from /v1/rounds/next, not /v1/rounds/start
          if (url.includes('/v1/rounds/next')) {
            const clone = response.clone();
            const data = await clone.json();
            // Remove youtube_url and spotify_url from first question's reveal
            if (data?.result?.reveal) {
              delete data.result.reveal.youtube_url;
              delete data.result.reveal.spotify_url;
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

    // Wait for timeout (15 seconds + buffer)
    await page.waitForTimeout(16_000);
    await expect(page.getByText('Timeout')).toBeVisible();
    await expect(page.getByText('? 1', { exact: true })).toBeVisible();

    // Phase 1: Check that links are not displayed when youtube_url/spotify_url are missing
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
    // After Phase 4 a11y improvements, answer is in <dl> structure
    const answerDl = timeoutCard.locator('dl').filter({ hasText: 'Your answer:' });
    await expect(answerDl.locator('dt', { hasText: 'Your answer:' })).toBeVisible();
    await expect(answerDl.locator('dd', { hasText: '—' })).toBeVisible();

    await page.evaluate(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
    });
  });

  test('handles unsupported reveal providers', async ({ page }) => {
    // Phase 1: Intercept /v1/rounds/next to add unsupported provider URL
    await page.addInitScript(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      if (!anyWindow.__ORIGINAL_FETCH__) {
        anyWindow.__ORIGINAL_FETCH__ = window.fetch;
      }
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
          const requestInput = args[0];
          const url =
            typeof requestInput === 'string'
              ? requestInput
              : requestInput instanceof URL
                ? requestInput.toString()
                : requestInput.url;
          // Phase 1: reveal comes from /v1/rounds/next
          if (url.includes('/v1/rounds/next')) {
            const data = await response.clone().json();
            if (data?.result?.reveal) {
              // Remove all known providers and add only other_url
              delete data.result.reveal.youtube_url;
              delete data.result.reveal.spotify_url;
              delete data.result.reveal.apple_music_url;
              // Add an unsupported provider URL (Phase 1 uses other_url for unknown providers)
              data.result.reveal.other_url = 'https://example.com/unknown';
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

    // Phase 1: Check for "other" provider link
    const fallbackLink = page.getByRole('link', { name: /Open in other/i });
    await expect(fallbackLink).toBeVisible();
    await expect(fallbackLink).toHaveAttribute('href', 'https://example.com/unknown');
    await expect(page.locator('iframe[title="Player"]')).toHaveCount(0);

    await page.evaluate(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
    });
  });

  test('records metrics events for toggle and reveal interactions', async ({ page, context }) => {
    await context.route('https://www.youtube.com/**', (route) => route.abort());

    await page.addInitScript(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      if (!anyWindow.__ORIGINAL_FETCH__) {
        anyWindow.__ORIGINAL_FETCH__ = window.fetch;
      }
      const batches: MetricsBatch[] = [];
      const originalFetch = window.fetch;

      (window as InstrumentedWindow).__METRICS_LOG__ = batches;

      window.fetch = async (...args) => {
        const request =
          typeof args[0] === 'string' || args[0] instanceof URL ? new Request(args[0], args[1]) : args[0];
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

    // Click the external link (text may vary based on locale)
    const revealLink = page.locator('a[target="_blank"][rel="noopener noreferrer"]').first();
    await revealLink.click();

    await page.waitForFunction(() => {
      const batches = (window as unknown as InstrumentedWindow).__METRICS_LOG__;
      if (!batches) return false;
      return batches.flatMap((batch) => batch.events ?? []).length >= 3;
    }, { timeout: 15_000 });

    const getMetricEvents = () =>
      page.evaluate(() => {
        const batches = (window as unknown as InstrumentedWindow).__METRICS_LOG__;
        if (!batches) return [];
        return batches.flatMap((batch) => batch.events ?? []);
      });

    await expect
      .poll(async () => {
        const events = await getMetricEvents();
        return events.map((event) => event.name);
      }, { timeout: 10_000, message: 'Waiting for reveal_open_external metric' })
      .toContain('reveal_open_external');

    const metricEvents = await getMetricEvents();
    const names = new Set(metricEvents.map((event) => event.name));
    expect(names).toContain('settings_inline_toggle');
    expect(names).toContain('answer_result');
    expect(names).toContain('reveal_open_external');

    const answerResult = metricEvents.find((event) => event.name === 'answer_result');
    expect(answerResult?.attrs).toMatchObject({ outcome: 'correct', questionId: QUESTION_IDS[0] });

    await page.evaluate(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      if (anyWindow.__ORIGINAL_FETCH__) {
        window.fetch = anyWindow.__ORIGINAL_FETCH__;
        delete anyWindow.__ORIGINAL_FETCH__;
      }
    });
  });

  test('retries metrics flush after 429 responses', async ({ page }) => {
    await page.addInitScript(() => {
      const anyWindow = window as unknown as InstrumentedWindow;

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
          const request =
            typeof args[0] === 'string' || args[0] instanceof URL ? new Request(args[0], args[1]) : args[0];
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

    await page.waitForFunction(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      const events = anyWindow.__METRICS_LOG__?.flatMap((batch) => batch.events ?? []) ?? [];
      return events.some((event) => event.name === 'answer_result');
    }, { timeout: 10_000 });

    const result = await page.evaluate(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
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
    const start = result.events.find((event) => event.name === 'quiz_start');
    const answer = result.events.find((event) => event.name === 'answer_result');
    expect(start).toBeTruthy();
    expect(typeof start?.attrs?.mode).toBe('string');
    expect(['treatment', 'control']).toContain(String(start?.attrs?.arm ?? ''));
    expect(answer).toBeTruthy();
    expect(typeof answer?.attrs?.mode).toBe('string');
    expect(['treatment', 'control']).toContain(String(answer?.attrs?.arm ?? '')); 
    expect(typeof answer?.attrs?.remainingSeconds).toBe('number');
    expect(typeof answer?.attrs?.elapsedMs).toBe('number');
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
          const request =
            typeof args[0] === 'string' || args[0] instanceof URL ? new Request(args[0], args[1]) : args[0];
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
      const anyWindow = window as unknown as InstrumentedWindow;
      return (anyWindow.__METRICS_ATTEMPTS__ ?? 0) >= 3;
    }, { timeout: 15_000 });

    await page.waitForFunction(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
      const events = anyWindow.__METRICS_LOG__?.flatMap((batch) => batch.events ?? []) ?? [];
      return events.length >= 1;
    }, { timeout: 15_000 });

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('vgm2.metrics.queue'));
      return raw;
    }).toBeNull();

    const result = await page.evaluate(() => {
      const anyWindow = window as unknown as InstrumentedWindow;
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
    const answer = result.events.find((event) => event.name === 'answer_result');
    expect(answer).toBeTruthy();
    expect(typeof answer?.attrs?.mode).toBe('string');
    expect(['treatment', 'control']).toContain(String(answer?.attrs?.arm ?? ''));
    expect(typeof answer?.attrs?.remainingSeconds).toBe('number');
    expect(typeof answer?.attrs?.elapsedMs).toBe('number');
  });
});

test.describe('Filter-based quiz scenarios (Phase 2D)', () => {
  test('difficulty filter: hard selection sends correct filter to API', async ({ page }) => {
    await page.goto('/play?autostart=0');
    await expect(page.getByTestId('filter-selector-title')).toBeVisible({ timeout: 10_000 });

    const hardRadio = page.locator('input[name="difficulty"][value="hard"]');
    await hardRadio.check();
    await expect(hardRadio).toBeChecked();

    const request = await waitForStartRequest(page, async () => {
      await page.getByTestId('filter-start-button').click();
    });
    const body = parseStartRequest(request);
    expect(body.filters?.difficulty).toEqual(['hard']);

    await expect(page.getByTestId('question-prompt')).toBeVisible({ timeout: 60_000 });
  });

  test('era filter: 90s selection is shown on the result page', async ({ page }) => {
    await page.goto('/play?autostart=0');
    await expect(page.getByTestId('filter-selector-title')).toBeVisible({ timeout: 10_000 });

    const ninetiesRadio = page.locator('input[name="era"][value="90s"]');
    await ninetiesRadio.check();
    await expect(ninetiesRadio).toBeChecked();

    const request = await waitForStartRequest(page, async () => {
      await page.getByTestId('filter-start-button').click();
    });
    const body = parseStartRequest(request);
    expect(body.filters?.era).toEqual(['90s']);

    await expect(page.getByTestId('question-prompt')).toBeVisible({ timeout: 60_000 });
    await completeQuizAndNavigateToResult(page);

    const eraFilterDisplay = page.getByTestId('applied-filter-era');
    await expect(eraFilterDisplay).toHaveText(/90年代|90s/);
  });

  test('series filter: multiple selection sends array to API', async ({ page }) => {
    await page.goto('/play?autostart=0');
    await expect(page.getByTestId('filter-selector-title')).toBeVisible({ timeout: 10_000 });

    const ffCheckbox = page.locator('input[type="checkbox"][value="ff"]');
    const zeldaCheckbox = page.locator('input[type="checkbox"][value="zelda"]');
    await ffCheckbox.check();
    await zeldaCheckbox.check();
    await expect(ffCheckbox).toBeChecked();
    await expect(zeldaCheckbox).toBeChecked();

    const request = await waitForStartRequest(page, async () => {
      await page.getByTestId('filter-start-button').click();
    });
    const body = parseStartRequest(request);
    expect(body.filters?.series).toEqual(expect.arrayContaining(['ff', 'zelda']));

    await expect(page.getByTestId('question-prompt')).toBeVisible({ timeout: 60_000 });
  });

  test('combined filters: difficulty + era send both values to API', async ({ page }) => {
    await page.goto('/play?autostart=0');
    await expect(page.getByTestId('filter-selector-title')).toBeVisible({ timeout: 10_000 });

    await page.locator('input[name="difficulty"][value="easy"]').check();
    await page.locator('input[name="era"][value="80s"]').check();

    const request = await waitForStartRequest(page, async () => {
      await page.getByTestId('filter-start-button').click();
    });
    const body = parseStartRequest(request);
    expect(body.filters?.difficulty).toEqual(['easy']);
    expect(body.filters?.era).toEqual(['80s']);

    await expect(page.getByTestId('question-prompt')).toBeVisible({ timeout: 60_000 });
  });

  test('reset button restores mixed (default) filters', async ({ page }) => {
    await page.goto('/play?autostart=0');
    await expect(page.getByTestId('filter-selector-title')).toBeVisible({ timeout: 10_000 });

    await page.locator('input[name="difficulty"][value="hard"]').check();
    await page.locator('input[name="era"][value="90s"]').check();

    const resetButton = page.getByTestId('filter-reset-button');
    await resetButton.click();

    await expect(page.locator('input[name="difficulty"][value="mixed"]').first()).toBeChecked();
    await expect(page.locator('input[name="era"][value="mixed"]').first()).toBeChecked();
  });

  test('error handling: 503 no_questions error shows localized toast message', async ({ page }) => {
    await enableStartErrorInterceptor(page);
    await page.goto('/play?autostart=0');
    await expect(page.getByTestId('filter-selector-title')).toBeVisible({ timeout: 10_000 });

    const hardRadio = page.locator('input[name="difficulty"][value="hard"]');
    const nineties = page.locator('input[name="era"][value="90s"]');
    await hardRadio.check();
    await nineties.check();

    await page.evaluate(() => {
      (window as unknown as { __VGQ_FORCE_START_ERROR__?: string | null }).__VGQ_FORCE_START_ERROR__ = 'no_questions';
    });

    await page.getByTestId('filter-start-button').click();

    const toast = page.getByTestId('toast-notification');
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText(/available|不足|condition/);
    await expect(page.getByTestId('filter-selector-title')).toBeVisible();
  });
});

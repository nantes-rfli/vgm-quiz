import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const QUESTION_PROMPT_TIMEOUT = 60_000;

async function loadPlayPage(page: import('@playwright/test').Page) {
  await page.goto('/play');
  await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
    timeout: 15_000,
  }).catch(() => {
    // continue even if the flag is not exposed (server mode)
  });
  const startButton = page.getByRole('button', { name: 'Start' });
  try {
    await startButton.waitFor({ timeout: 5000 });
    if (await startButton.isVisible()) {
      await startButton.click();
    }
  } catch {
    // auto-start is enabled; ignore if button never appears
  }
  await page.getByTestId('question-prompt').waitFor({ timeout: QUESTION_PROMPT_TIMEOUT });
}

test.describe('Accessibility smoke', () => {
  test('play page has no WCAG AA violations', async ({ page }) => {
    await loadPlayPage(page);

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Filter out known incomplete results due to Tailwind v4 oklab color format
    // axe-core v4.10 cannot parse oklab() colors yet
    const unexpectedIncomplete = results.incomplete.filter((issue) => {
      if (issue.id !== 'color-contrast') return true;
      // Only exclude if ALL nodes have oklab parsing errors (avoid discarding unrelated issues)
      const allNodesAreOklabErrors = issue.nodes?.every((node) =>
        node.any?.some((check) => check.message?.includes('Unable to parse color "oklab'))
      );
      return !allNodesAreOklabErrors;
    });
    expect.soft(unexpectedIncomplete, 'axe should finish scanning').toHaveLength(0);
    expect(results.violations, `Found accessibility issues on /play: ${JSON.stringify(results.violations, null, 2)}`).toHaveLength(0);
  });

  test('result page has no WCAG AA violations', async ({ page }) => {
    await loadPlayPage(page);

    // Complete quiz quickly by answering all questions
    for (let index = 0; index < 10; index++) {
      await page.getByTestId('question-prompt').waitFor({ timeout: QUESTION_PROMPT_TIMEOUT });
      const choiceButtons = page.locator('[data-testid^="choice-"]');
      await choiceButtons.first().click();
      await page.getByRole('button', { name: 'Answer (Enter)' }).click();
      await page.getByTestId('reveal-next').click();
    }

    await page.waitForURL('**/result');
    await page.getByRole('heading', { name: /Result/i }).waitFor({ timeout: QUESTION_PROMPT_TIMEOUT });

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Filter out known incomplete results due to Tailwind v4 oklab color format
    // axe-core v4.10 cannot parse oklab() colors yet
    const unexpectedIncomplete = results.incomplete.filter((issue) => {
      if (issue.id !== 'color-contrast') return true;
      // Only exclude if ALL nodes have oklab parsing errors (avoid discarding unrelated issues)
      const allNodesAreOklabErrors = issue.nodes?.every((node) =>
        node.any?.some((check) => check.message?.includes('Unable to parse color "oklab'))
      );
      return !allNodesAreOklabErrors;
    });
    expect.soft(unexpectedIncomplete, 'axe should finish scanning').toHaveLength(0);
    expect(results.violations, `Found accessibility issues on /result: ${JSON.stringify(results.violations, null, 2)}`).toHaveLength(0);
  });
});

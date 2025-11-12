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

  test('FilterSelector has proper labels and grouping', async ({ page }) => {
    await page.goto('/play');
    await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
      timeout: 15_000,
    }).catch(() => {
      // continue even if the flag is not exposed (server mode)
    });

    // Wait for FilterSelector to load (manifest should be visible)
    const filterTitle = page.getByText(/フィルター|Filter/i);
    await expect(filterTitle).toBeVisible({ timeout: 10_000 });

    // Check that difficulty section has proper label (section should be accessible)
    const difficultyLabel = page.locator('label', { hasText: /難易度|Difficulty/i });
    await expect(difficultyLabel).toBeVisible();

    // Verify difficulty section is properly associated (labeled radio buttons)
    const difficultyRadios = page.locator('input[name="difficulty"]');
    await expect(difficultyRadios).toHaveCount(4); // mixed + easy/normal/hard
    for (let i = 0; i < 4; i++) {
      const radio = difficultyRadios.nth(i);
      const label = page.locator('label').filter({ has: radio });
      await expect(label).toHaveCount(1); // Each radio should have one label
    }

    // Check that era section has proper label
    const eraLabel = page.locator('label', { hasText: /年代|Era/i });
    await expect(eraLabel).toBeVisible();

    // Verify era radio buttons are accessible
    const eraRadios = page.locator('input[name="era"]');
    await expect(eraRadios).toHaveCount(6); // mixed + 80s/90s/00s/10s/20s
    for (let i = 0; i < 6; i++) {
      const radio = eraRadios.nth(i);
      const label = page.locator('label').filter({ has: radio });
      await expect(label).toHaveCount(1);
    }

    // Check that series section has proper label
    const seriesLabel = page.locator('label', { hasText: /シリーズ|Series/i });
    await expect(seriesLabel).toBeVisible();

    // Verify checkboxes for series are properly labeled
    const seriesCheckboxes = page.locator('input[type="checkbox"]');
    const seriesCount = await seriesCheckboxes.count();
    expect(seriesCount).toBeGreaterThan(0); // Should have at least 1 checkbox
  });

  test('FilterSelector supports keyboard navigation', async ({ page }) => {
    await page.goto('/play');
    await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
      timeout: 15_000,
    }).catch(() => {
      // continue even if the flag is not exposed (server mode)
    });

    // Wait for FilterSelector to load
    const filterTitle = page.getByText(/フィルター|Filter/i);
    await expect(filterTitle).toBeVisible({ timeout: 10_000 });

    // Focus on first difficulty radio button
    const difficultyRadios = page.locator('input[name="difficulty"]');
    const firstRadio = difficultyRadios.nth(0);
    await firstRadio.focus();
    await expect(firstRadio).toBeFocused();

    // Press right arrow to move to next radio button
    await page.keyboard.press('ArrowRight');
    const secondRadio = difficultyRadios.nth(1);
    await expect(secondRadio).toBeFocused();

    // Press left arrow to go back
    await page.keyboard.press('ArrowLeft');
    await expect(firstRadio).toBeFocused();

    // Tab to next section (should move through radio group to next focusable)
    await page.keyboard.press('Tab');
    // Next focus should be somewhere in the page (likely another form element)
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('type'));
    // Should have moved focus to another element
    const stillFirstRadio = await firstRadio.evaluate((el) => el === document.activeElement);
    expect(stillFirstRadio).toBe(false); // Should have moved away from first radio

    // Test that we can reach era section via Tab
    await page.keyboard.press('Shift+Tab'); // Tab back
    await page.keyboard.press('Tab'); // Move forward again through elements
    await page.keyboard.press('Tab');

    const focusedType = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedType).toBe('INPUT'); // Should be on an input element
  });

  test('FilterSelector maintains focus during filter changes', async ({ page }) => {
    await page.goto('/play');
    await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
      timeout: 15_000,
    }).catch(() => {
      // continue even if the flag is not exposed (server mode)
    });

    // Wait for FilterSelector
    const filterTitle = page.getByText(/フィルター|Filter/i);
    await expect(filterTitle).toBeVisible({ timeout: 10_000 });

    // Get a radio button and verify it can receive focus
    const difficultyRadios = page.locator('input[name="difficulty"]');
    const firstRadio = difficultyRadios.nth(0);

    // Focus the element
    await firstRadio.focus();
    const focused = await firstRadio.evaluate((el) => el === document.activeElement);
    expect(focused).toBe(true);

    // Change its state (check it)
    if (!(await firstRadio.isChecked())) {
      await firstRadio.check();
    }

    // Verify it's still focused after change
    const stillFocused = await firstRadio.evaluate((el) => el === document.activeElement);
    expect(stillFocused).toBe(true);
  });

  test('FilterSelector uses proper ARIA associations', async ({ page }) => {
    await page.goto('/play');
    await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
      timeout: 15_000,
    }).catch(() => {
      // continue even if the flag is not exposed (server mode)
    });

    // Wait for FilterSelector to load
    const filterTitle = page.getByText(/フィルター|Filter/i);
    await expect(filterTitle).toBeVisible({ timeout: 10_000 });

    // Verify that each radio/checkbox has an associated label
    // Difficulty section
    const difficultyRadios = page.locator('input[name="difficulty"]');
    for (let i = 0; i < await difficultyRadios.count(); i++) {
      const radio = difficultyRadios.nth(i);
      const label = page.locator('label').filter({ has: radio });
      // Each radio should be wrapped in or associated with a label
      await expect(label).toHaveCount(1);
    }

    // Era section
    const eraRadios = page.locator('input[name="era"]');
    for (let i = 0; i < await eraRadios.count(); i++) {
      const radio = eraRadios.nth(i);
      const label = page.locator('label').filter({ has: radio });
      await expect(label).toHaveCount(1);
    }

    // Series section - checkboxes
    const seriesCheckboxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < await seriesCheckboxes.count(); i++) {
      const checkbox = seriesCheckboxes.nth(i);
      const label = page.locator('label').filter({ has: checkbox });
      // Each checkbox should have an associated label
      await expect(label).toHaveCount(1);
    }

    // Verify section headings are visible (for grouping context)
    const difficultyHeading = page.locator('label', { hasText: /難易度|Difficulty/i });
    await expect(difficultyHeading).toBeVisible();

    const eraHeading = page.locator('label', { hasText: /年代|Era/i });
    await expect(eraHeading).toBeVisible();

    const seriesHeading = page.locator('label', { hasText: /シリーズ|Series/i });
    await expect(seriesHeading).toBeVisible();
  });
});

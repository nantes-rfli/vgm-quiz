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
    const filterTitle = page.getByTestId('filter-selector-title');
    await expect(filterTitle).toBeVisible({ timeout: 10_000 });

    // Verify legend elements exist (fieldset + legend structure)
    const difficultyLegend = page.locator('#difficulty-legend');
    await expect(difficultyLegend).toBeVisible();
    await expect(difficultyLegend).toHaveText(/難易度|Difficulty/i);

    const eraLegend = page.locator('#era-legend');
    await expect(eraLegend).toBeVisible();
    await expect(eraLegend).toHaveText(/年代|Era/i);

    const seriesLegend = page.locator('#series-legend');
    await expect(seriesLegend).toBeVisible();
    await expect(seriesLegend).toHaveText(/シリーズ|Series/i);

    // Verify difficulty section is properly associated (radio buttons have labels)
    const difficultyRadios = page.locator('input[name="difficulty"]');
    await expect(difficultyRadios).toHaveCount(4); // mixed + easy/normal/hard

    // Verify all difficulty inputs have aria-labels or are in label elements
    for (let i = 0; i < 4; i++) {
      const radio = difficultyRadios.nth(i);
      const hasAriaLabel = await radio.getAttribute('aria-label');
      const isInLabel = await radio.evaluate((el) => {
        return el.closest('label') !== null;
      });
      expect(hasAriaLabel || isInLabel).toBeTruthy();
    }

    // Verify era radio buttons are accessible
    const eraRadios = page.locator('input[name="era"]');
    await expect(eraRadios).toHaveCount(6); // mixed + 80s/90s/00s/10s/20s

    // Verify all era inputs have aria-labels or are in label elements
    for (let i = 0; i < 6; i++) {
      const radio = eraRadios.nth(i);
      const hasAriaLabel = await radio.getAttribute('aria-label');
      const isInLabel = await radio.evaluate((el) => {
        return el.closest('label') !== null;
      });
      expect(hasAriaLabel || isInLabel).toBeTruthy();
    }

    // Verify checkboxes for series are properly labeled
    const seriesCheckboxes = page.locator('input[type="checkbox"]');
    const seriesCount = await seriesCheckboxes.count();
    expect(seriesCount).toBeGreaterThan(0); // Should have at least 1 checkbox

    for (let i = 0; i < await seriesCheckboxes.count(); i++) {
      const checkbox = seriesCheckboxes.nth(i);
      const hasAriaLabel = await checkbox.getAttribute('aria-label');
      const isInLabel = await checkbox.evaluate((el) => {
        return el.closest('label') !== null;
      });
      expect(hasAriaLabel || isInLabel).toBeTruthy();
    }
  });

  test('FilterSelector supports keyboard navigation', async ({ page }) => {
    await page.goto('/play');
    await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
      timeout: 15_000,
    }).catch(() => {
      // continue even if the flag is not exposed (server mode)
    });

    // Wait for FilterSelector to load
    const filterTitle = page.getByTestId('filter-selector-title');
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
    const filterTitle = page.getByTestId('filter-selector-title');
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

  test('FilterSelector uses proper ARIA associations and fieldset grouping', async ({ page }) => {
    await page.goto('/play');
    await page.waitForFunction(() => (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ === true, {
      timeout: 15_000,
    }).catch(() => {
      // continue even if the flag is not exposed (server mode)
    });

    // Wait for FilterSelector to load
    const filterTitle = page.getByTestId('filter-selector-title');
    await expect(filterTitle).toBeVisible({ timeout: 10_000 });

    // Verify fieldsets with legends are present (proper form grouping)
    // Difficulty fieldset
    const difficultyFieldset = page.locator('fieldset').filter({ has: page.locator('#difficulty-legend') });
    await expect(difficultyFieldset).toHaveCount(1);
    const difficultyLegend = page.locator('#difficulty-legend');
    await expect(difficultyLegend).toHaveText(/難易度|Difficulty/i);

    // Era fieldset
    const eraFieldset = page.locator('fieldset').filter({ has: page.locator('#era-legend') });
    await expect(eraFieldset).toHaveCount(1);
    const eraLegend = page.locator('#era-legend');
    await expect(eraLegend).toHaveText(/年代|Era/i);

    // Series fieldset
    const seriesFieldset = page.locator('fieldset').filter({ has: page.locator('#series-legend') });
    await expect(seriesFieldset).toHaveCount(1);
    const seriesLegend = page.locator('#series-legend');
    await expect(seriesLegend).toHaveText(/シリーズ|Series/i);

    // Verify role="group" with aria-labelledby on option containers
    const difficultyGroup = page.locator('[role="group"][aria-labelledby="difficulty-legend"]');
    await expect(difficultyGroup).toHaveCount(1);

    const eraGroup = page.locator('[role="group"][aria-labelledby="era-legend"]');
    await expect(eraGroup).toHaveCount(1);

    const seriesGroup = page.locator('[role="group"][aria-labelledby="series-legend"]');
    await expect(seriesGroup).toHaveCount(1);

    // Verify that each radio/checkbox has an associated label or aria-label
    // Difficulty section
    const difficultyRadios = page.locator('input[name="difficulty"]');
    for (let i = 0; i < await difficultyRadios.count(); i++) {
      const radio = difficultyRadios.nth(i);
      const hasAriaLabel = await radio.getAttribute('aria-label');
      const isInLabel = await radio.evaluate((el) => {
        return el.closest('label') !== null;
      });
      expect(hasAriaLabel || isInLabel).toBeTruthy();
    }

    // Era section
    const eraRadios = page.locator('input[name="era"]');
    for (let i = 0; i < await eraRadios.count(); i++) {
      const radio = eraRadios.nth(i);
      const hasAriaLabel = await radio.getAttribute('aria-label');
      const isInLabel = await radio.evaluate((el) => {
        return el.closest('label') !== null;
      });
      expect(hasAriaLabel || isInLabel).toBeTruthy();
    }

    // Series section - checkboxes
    const seriesCheckboxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < await seriesCheckboxes.count(); i++) {
      const checkbox = seriesCheckboxes.nth(i);
      const hasAriaLabel = await checkbox.getAttribute('aria-label');
      const isInLabel = await checkbox.evaluate((el) => {
        return el.closest('label') !== null;
      });
      expect(hasAriaLabel || isInLabel).toBeTruthy();
    }
  });
});

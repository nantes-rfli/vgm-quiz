import { test, expect } from '@playwright/test';
import { ANSWERS } from '../../mocks/fixtures/rounds/answers';

const QUESTION_IDS = Object.keys(ANSWERS).sort();

test.describe('Smoke: complete quiz and reach result', () => {
  test('user can finish a round and see the result summary', async ({ page }) => {
    await page.goto('/play');

    for (const [index, questionId] of QUESTION_IDS.entries()) {
      const choiceId = ANSWERS[questionId];

      // Progress indicator should show current question number (1-based)
      const questionNumber = index + 1;
      await expect(page.getByText(new RegExp(`Question ${questionNumber} /`))).toBeVisible();

      // Answer the question with the known correct choice from fixtures
      await page.getByTestId(`choice-${choiceId}`).click();
      await page.getByRole('button', { name: 'Answer (Enter)' }).click();

      // Reveal phase should appear before continuing
      await expect(page.getByRole('heading', { name: 'Listen / Watch' })).toBeVisible();
      await page.getByRole('button', { name: 'Next' }).click();
    }

    await page.waitForURL('**/result');
    await expect(page).toHaveURL(/\/result$/);
    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible();
    await expect(page.getByText(/Score/)).toBeVisible();
    await expect(page.getByText(/Answered: 10/)).toBeVisible();
  });
});

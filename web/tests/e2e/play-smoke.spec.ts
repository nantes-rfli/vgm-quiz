import { test, expect } from '@playwright/test';
import { ANSWERS } from '../../mocks/fixtures/rounds/answers';

const QUESTION_IDS = Object.keys(ANSWERS).sort();

test.describe('Smoke: complete quiz and reach result', () => {
  test('user can finish a round and see the result summary', async ({ page }) => {
    await page.goto('/play');
    const questionPrompt = page.getByTestId('question-prompt');

    for (const [index, questionId] of QUESTION_IDS.entries()) {
      const choiceId = ANSWERS[questionId];

      // Wait until the current question prompt is displayed before interacting
      await expect(questionPrompt).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`choice-${choiceId}`)).toBeVisible({ timeout: 15_000 });

      // Answer the question with the known correct choice from fixtures
      await page.getByTestId(`choice-${choiceId}`).click();
      const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Reveal phase should appear before continuing
      await expect(page.getByRole('heading', { name: 'Listen / Watch' })).toBeVisible();
      await page.getByTestId('reveal-next').click();
    }

    await page.waitForURL('**/result');
    await expect(page).toHaveURL(/\/result$/);
    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible();
    await expect(page.getByText(/Score/)).toBeVisible();
    await expect(page.getByText(/Answered: 10/)).toBeVisible();
  });
});

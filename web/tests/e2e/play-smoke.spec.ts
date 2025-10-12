import { test, expect } from '@playwright/test';
import { ANSWERS } from '../../mocks/fixtures/rounds/answers';

const QUESTION_IDS = Object.keys(ANSWERS).sort();

test.describe('Smoke: complete quiz and reach result', () => {
  test('user can finish a round and see the result summary', async ({ page }) => {
    await page.goto('/play');
    const questionPrompt = page.getByTestId('question-prompt');
    const retryButton = page.getByRole('button', { name: /Retry/i });

    const waitForQuestion = async (timeout: number, questionId: string) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        try {
          await questionPrompt.waitFor({ state: 'visible', timeout: 500 });
          const attr = await questionPrompt.getAttribute('data-question-id');
          if (attr === questionId) return;
        } catch {
          if (await retryButton.isVisible({ timeout: 100 }).catch(() => false)) {
            await retryButton.click();
          }
        }
      }
      await expect(questionPrompt).toHaveAttribute('data-question-id', questionId, { timeout: 1000 });
    };

    for (const [index, questionId] of QUESTION_IDS.entries()) {
      const choiceId = ANSWERS[questionId];
      const waitTimeout = index === 0 ? 60_000 : 15_000;

      // Wait until the current question prompt is displayed before interacting
      await waitForQuestion(waitTimeout, questionId);
      await expect(page.getByTestId(`choice-${choiceId}`)).toBeVisible({ timeout: waitTimeout });

      // Answer the question with the known correct choice from fixtures
      await page.getByTestId(`choice-${choiceId}`).click();
      const submitButton = page.getByRole('button', { name: 'Answer (Enter)' });
      await expect(submitButton).toBeEnabled();
      await submitButton.click({ force: true });

      // Reveal phase should appear before continuing
      await page.getByTestId('reveal-next').waitFor({ timeout: waitTimeout });
      await expect(page.getByRole('heading', { name: 'Listen / Watch' })).toBeVisible({ timeout: waitTimeout });
      await page.getByTestId('reveal-next').click();
    }

    await page.waitForURL('**/result');
    await expect(page).toHaveURL(/\/result$/);
    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible();
    await expect(page.getByText(/Score/)).toBeVisible();
    await expect(page.getByText(/Answered: 10/)).toBeVisible();
  });
});

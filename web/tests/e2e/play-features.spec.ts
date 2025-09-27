import { test, expect, type Page } from '@playwright/test';
import { ANSWERS } from '../../mocks/fixtures/rounds/answers';

const QUESTION_IDS = Object.keys(ANSWERS).sort();

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
    let linklessInjected = false;
    await page.route('**/v1/rounds/next', async (route) => {
      const response = await route.fetch();
      const headers: Record<string, string> = {};
      response.headers().forEach((value, key) => {
        headers[key] = value;
      });
      let bodyText = await response.text();
      if (!linklessInjected) {
        try {
          const data = JSON.parse(bodyText) as {
            question?: { id?: string; reveal?: { links?: Array<unknown> } };
          };
          if (data?.question?.id === QUESTION_IDS[1]) {
            linklessInjected = true;
            if (data.question.reveal) {
              data.question.reveal.links = [];
              bodyText = JSON.stringify(data);
            }
          }
        } catch {
          // fall through with original body
        }
      }
      await route.fulfill({ status: response.status(), headers, body: bodyText });
    });

    await page.goto('/play');
    await waitForQuestion(page, 0);

    await page.waitForTimeout(16_000);
    await expect(page.getByText('Timeout')).toBeVisible();
    await expect(page.getByText('? 1', { exact: true })).toBeVisible();

    await page.getByTestId('reveal-next').click();

    await waitForQuestion(page, 1);
    const secondQuestionChoice = ANSWERS[QUESTION_IDS[1]];
    await page.getByTestId(`choice-${secondQuestionChoice}`).click();
    const submitSecond = page.getByRole('button', { name: 'Answer (Enter)' });
    await expect(submitSecond).toBeEnabled();
    await submitSecond.click();

    await expect(page.getByRole('heading', { name: 'Listen / Watch' })).toBeVisible();
    await expect(page.getByText('No links available')).toBeVisible();
    await page.getByTestId('reveal-next').click();

    for (const [index, questionId] of QUESTION_IDS.entries()) {
      if (index < 2) continue;
      await waitForQuestion(page, index);
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
  });
});

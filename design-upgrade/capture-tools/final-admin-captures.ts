import type { Browser, BrowserContext, Page } from '@playwright/test';

type Scenario = (
  browser: Browser,
  width: number,
  key: string,
  role: string,
  route: string,
  fn?: (page: Page, context: BrowserContext) => Promise<void>,
) => Promise<void>;

type Capture = (page: Page, key: string, role: string, state: string) => Promise<void>;

/**
 * Final admin-only gap captures. Import and call from baseline.spec.ts as
 * `await captureFinalAdminStates(scenario, browser, width, capture, accounts)`
 * after shared fixtures are seeded and before the context is closed by scenario.
 * All actions are reversible UI filters or view toggles; nothing is saved.
 */
export async function captureFinalAdminStates(
  scenario: Scenario,
  browser: Browser,
  width: number,
  capture: Capture,
  accounts: Record<string, { uid: string; email: string }>,
): Promise<void> {
  const role = 'admin';
  if (!accounts.admin?.uid || !accounts.admin?.email) {
    throw new Error('captureFinalAdminStates requires the seeded admin account.');
  }

  // This valid scope is intentionally outside the emulator's six seeded
  // syllabus/question scopes, producing the component's stable empty result.
  await scenario(browser, width, 'mcq-management-filtered-empty', role,
    '/admin/mcq-management?board=CBSE&standard=8th&subject=Science&chapter=Friction', async page => {
      await page.getByRole('heading', { name: 'Manage MCQs', exact: true }).waitFor({ state: 'visible' });
      await page.getByText('Select filters to view MCQs.', { exact: true }).waitFor({ state: 'visible', timeout: 20000 });
      await capture(page, 'mcq-management-filtered-empty', role, 'empty-filtered-bank');
    });

  // Search is client-side over the loaded rows and does not alter emulator data.
  await scenario(browser, width, 'question-library-empty-search', role, '/admin/question-library', async page => {
    await page.getByLabel('Board', { exact: true }).selectOption('ICSE');
    await page.getByLabel('Class', { exact: true }).selectOption('9');
    await page.getByLabel('Subject', { exact: true }).selectOption('Biology');
    const firstQuestion = page.locator('.qm-question').first();
    await firstQuestion.waitFor({ state: 'visible', timeout: 20000 });
    await page.getByLabel('Search loaded bank questions', { exact: true }).fill('no matching library fixture zzz');
    await page.getByText(/^0 of \d+ loaded$/, { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('.qm-paper-list .qm-question').length === 0);
    await capture(page, 'question-library-empty-search', role, 'empty-search-results');
  });

  // Saved papers is a view toggle. Do not open a row, which would resume a
  // potentially legacy draft and change the generator workflow state.
  await scenario(browser, width, 'paper-generator-saved-papers', role, '/admin/question-paper-generator', async page => {
    await page.getByRole('heading', { name: 'What are you preparing?', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Saved papers', exact: true }).click();
    const draftsHeading = page.locator('#drafts-heading');
    await draftsHeading.waitFor({ state: 'visible' });
    const draftRows = page.locator('.qpg-draft-row');
    const emptyDrafts = page.getByText('Saved papers will appear here for you and other admins.', { exact: true });
    const draftError = page.locator('section[aria-labelledby="drafts-heading"] .qpg-error[role="alert"]');
    await page.waitForFunction(() => !!document.querySelector('.qpg-draft-row') ||
      [...document.querySelectorAll('.muted-card')].some(node => node.textContent?.includes('Saved papers will appear here for you and other admins.')) ||
      !!document.querySelector('section[aria-labelledby="drafts-heading"] .qpg-error[role="alert"]'), undefined, { timeout: 20000 });
    if (await draftRows.count()) {
      await draftRows.first().waitFor({ state: 'visible' });
      await capture(page, 'paper-generator-saved-papers', role, 'saved-draft-list');
    } else if (await emptyDrafts.isVisible()) {
      await capture(page, 'paper-generator-saved-papers', role, 'saved-drafts-empty');
    } else {
      await draftError.waitFor({ state: 'visible' });
      await capture(page, 'paper-generator-saved-papers', role, 'saved-drafts-load-error');
    }
  });

  // Search only filters the loaded rows in this isolated page; it leaves the
  // seeded review queue intact for every other capture.
  await scenario(browser, width, 'question-review-empty-queue', role, '/admin/question-review', async page => {
      await page.getByRole('heading', { name: 'Review questions', exact: true }).waitFor({ state: 'visible' });
      await page.locator('.qr-row').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.getByLabel('Search loaded questions', { exact: true }).fill('no matching review fixture zzz');
      await page.getByText('No loaded questions match these filters.', { exact: true })
        .waitFor({ state: 'visible', timeout: 20000 });
      await capture(page, 'question-review-empty-queue', role, 'no-matching-questions');
    });
}

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

/** Additional safe admin captures for editor, confirmation, and no-result states. */
export async function captureAdminExtraStates(
  scenario: Scenario,
  browser: Browser,
  width: number,
  capture: Capture,
  accounts: Record<string, { uid: string; email: string }>,
): Promise<void> {
  const role = 'admin';
  if (!accounts.admin?.uid || !accounts.admin?.email) {
    throw new Error('captureAdminExtraStates requires the seeded admin account.');
  }

  await scenario(browser, width, 'review-individual-editor', role, '/admin/question-review', async page => {
    const row = page.locator('.qr-row').first();
    await row.waitFor({ state: 'visible', timeout: 20000 });
    await row.locator('button.qr-expand').click();
    await row.locator('.qr-detail').waitFor({ state: 'visible' });
    await row.getByRole('button', { name: 'Edit or decide this question', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit question' });
    await dialog.waitFor({ state: 'visible' });
    await capture(page, 'review-individual-editor-open', role, 'individual-question-editor');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  });

  await scenario(browser, width, 'add-mcq-parsed-preview', role, '/admin/add-mcq', async page => {
    await page.getByRole('heading', { name: 'Add MCQs' }).waitFor({ state: 'visible' });
    await page.getByLabel('MCQ JSON', { exact: true }).fill(JSON.stringify([{
      board: 'ICSE',
      standard: '9',
      subject: 'Biology',
      chapter: 'Cells',
      title: 'Cell fixture question',
      question: 'Which structure controls what enters and leaves a cell?',
      options: ['Cell membrane', 'Cell wall', 'Nucleus', 'Vacuole'],
      correctIndex: 0,
      solutions: ['The cell membrane regulates exchange with the environment.'],
    }]));
    await page.getByRole('button', { name: 'Parse MCQs', exact: true }).click();
    await page.getByText('MCQs parsed successfully!', { exact: true }).waitFor({ state: 'visible' });
    await page.locator('.mcq-preview').waitFor({ state: 'visible' });
    await capture(page, 'add-mcq-parsed-preview-visible', role, 'parsed-mcq-preview');
  });

  await scenario(browser, width, 'add-mcq-invalid-json', role, '/admin/add-mcq', async page => {
    await page.getByRole('heading', { name: 'Add MCQs' }).waitFor({ state: 'visible' });
    await page.getByLabel('MCQ JSON', { exact: true }).fill('{not valid JSON');
    await page.getByRole('button', { name: 'Parse MCQs', exact: true }).click();
    await page.getByText('Error parsing JSON. Please check your format.', { exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'add-mcq-invalid-json-feedback', role, 'invalid-json-snackbar');
  });

  await scenario(browser, width, 'action-plan-edit-existing', role, '/admin/action-plan', async page => {
    const edit = page.getByRole('button', { name: 'Edit activity', exact: true }).first();
    await edit.waitFor({ state: 'visible', timeout: 20000 });
    await edit.click();
    await page.getByRole('heading', { name: 'Keep the plan current' }).waitFor({ state: 'visible' });
    await page.getByLabel('Activity title', { exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'action-plan-existing-edit-form', role, 'existing-activity-edit');
    await page.getByRole('button', { name: 'Close action plan editor' }).click();
    await page.getByRole('heading', { name: 'Keep the plan current' }).waitFor({ state: 'hidden' });

    await page.getByLabel('Search activities', { exact: true }).fill('no matching fixture activity');
    await page.locator('.empty-state').getByRole('heading', { name: 'No matching activities' }).waitFor({ state: 'visible' });
    await capture(page, 'action-plan-filter-no-results', role, 'no-matching-activities');
  });

  await scenario(browser, width, 'question-bank-priority-detail', role, '/admin/question-bank', async page => {
    const priority = page.locator('.qb-priority').first();
    await priority.waitFor({ state: 'visible', timeout: 20000 });
    await priority.click();
    await page.locator('main.qb-detail').getByRole('heading', { name: 'Cells', exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'question-bank-selected-priority-detail', role, 'selected-priority-detail');
  });

  await scenario(browser, width, 'question-bank-priority-no-results', role, '/admin/question-bank', async page => {
    await page.locator('input[aria-label="Filter priorities"]').waitFor({ state: 'visible' });
    await page.locator('input[aria-label="Filter priorities"]').fill('unmatched fixture phrase zzz');
    await page.locator('.qb-empty').waitFor({ state: 'visible' });
    await capture(page, 'question-bank-priority-filter-empty', role, 'no-matching-priorities');
  });

  await scenario(browser, width, 'question-library-edit-existing', role, '/admin/question-library', async page => {
    await openCellsLibrary(page);
    const question = page.locator('.qm-question').first();
    await question.waitFor({ state: 'visible', timeout: 20000 });
    await question.locator('details summary').click();
    await question.getByRole('button', { name: 'Edit question', exact: true }).click();
    const editor = page.locator('form#bank-editor');
    await editor.waitFor({ state: 'visible' });
    await capture(page, 'question-library-existing-question-editor', role, 'existing-question-edit');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
  });

  await scenario(browser, width, 'question-library-archive-confirmation', role, '/admin/question-library', async page => {
    await openCellsLibrary(page);
    const question = page.locator('.qm-question').first();
    await question.waitFor({ state: 'visible', timeout: 20000 });
    await question.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Archive selected', exact: true }).click();
    await page.getByText('Remove from the active bank?', { exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Confirm archive', exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'question-library-archive-confirmation-open', role, 'archive-confirmation');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
}

async function openCellsLibrary(page: Page): Promise<void> {
  await page.getByLabel('Board', { exact: true }).selectOption('ICSE');
  await page.getByLabel('Class', { exact: true }).selectOption('9');
  await page.getByLabel('Subject', { exact: true }).selectOption('Biology');
  await page.locator('.qm-question').first().waitFor({ state: 'visible', timeout: 20000 });
}

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
 * Captures interactive admin states that the route-only baseline does not cover.
 * All state changes are local to the rendered page except emulator-backed reads;
 * this helper deliberately stops before destructive/admin decision submissions.
 */
export async function captureAdminStates(
  scenario: Scenario,
  browser: Browser,
  width: number,
  capture: Capture,
  accounts: Record<string, { uid: string; email: string }>,
): Promise<void> {
  const role = 'admin';
  // Keep the fixture account in the signature contract and fail clearly if the
  // caller has not seeded the admin identity used by the route harness.
  if (!accounts.admin?.uid || !accounts.admin?.email) {
    throw new Error('captureAdminStates requires the seeded admin account.');
  }

  await scenario(browser, width, 'paper-generator-stages', role, '/admin/question-paper-generator', async page => {
    await page.getByRole('heading', { name: 'What are you preparing?' }).waitFor({ state: 'visible' });
    await capture(page, 'paper-generator-stages', role, 'stage-1-format');

    const format = page.locator('.qpg-format-option').first();
    await format.waitFor({ state: 'visible' });
    await format.click();
    await page.getByRole('heading', { name: 'Choose what to cover' }).waitFor({ state: 'visible' });

    // The supplied fixture uses ICSE / 9 / Biology / Cells. Fall back to the
    // first available syllabus values if the checked-in curriculum seed differs.
    const board = page.getByLabel('Board', { exact: true });
    if (await board.count()) {
      const options = await board.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
      await board.selectOption(options.includes('ICSE') ? 'ICSE' : options.find(Boolean) ?? '');
    }
    const standard = page.getByLabel('Standard', { exact: true });
    if (await standard.count()) {
      const options = await standard.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
      await standard.selectOption(options.includes('9') ? '9' : options.find(Boolean) ?? '');
    }
    await page.waitForTimeout(250);
    const subjectSelector = page.locator('.qpg-selector').first();
    const subjectChoices = subjectSelector.locator('.qpg-chip').filter({ hasText: 'Biology' }).locator('input[type=checkbox]');
    const subjectFallback = subjectSelector.locator('.qpg-chip input[type=checkbox]');
    const subjectChoice = await subjectChoices.count() ? subjectChoices.first() : subjectFallback.first();
    await subjectChoice.waitFor({ state: 'visible' });
    if (!(await subjectChoice.isChecked())) await subjectChoice.check();
    await page.waitForTimeout(200);
    const chapterChoices = page.locator('.qpg-chapters .qpg-chip').filter({ hasText: 'Cells' }).locator('input[type=checkbox]');
    const chapterFallback = page.locator('.qpg-chapters .qpg-chip input[type=checkbox]');
    const chapterChoice = await chapterChoices.count() ? chapterChoices.first() : chapterFallback.first();
    await chapterChoice.waitFor({ state: 'visible' });
    if (!(await chapterChoice.isChecked())) await chapterChoice.check();

    // A minimal local plan makes a preview possible from the five approved
    // question fixtures without saving the setup or creating a request. The
    // section rows live in collapsed native details until their summary opens.
    const sectionPlan = page.locator('details.qpg-plan');
    const sectionPlanSummary = sectionPlan.locator(':scope > summary');
    await sectionPlanSummary.waitFor({ state: 'visible' });
    if (!(await sectionPlan.evaluate((node: HTMLDetailsElement) => node.open))) await sectionPlanSummary.click();
    const firstCount = sectionPlan.locator('.qpg-rule-row input[type=number]').first();
    await firstCount.waitFor({ state: 'visible' });
    await firstCount.fill('1');
    await capture(page, 'paper-generator-stages', role, 'stage-2-syllabus-and-sections');

    // The generator switches controls using container queries, so viewport
    // width alone does not identify the visible action at desktop widths.
    const availabilityCandidates = [
      page.locator('.qpg-desktop-check'),
      page.locator('.qpg-mobile-bar').getByRole('button', { name: 'Check availability', exact: true }),
    ];
    const availability = await firstVisible(availabilityCandidates);
    await availability.click();
    await page.locator('.qpg-stat-grid').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('heading', { name: 'Check the question bank', exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'paper-generator-stages', role, 'stage-3-coverage');

    const preview = await firstVisible([
      page.locator('section[aria-labelledby="coverage-heading"]').getByRole('button', { name: /^(Preview paper|Preview available questions)$/ }),
      page.locator('.qpg-mobile-bar').getByRole('button', { name: /^(Preview paper|Preview available questions)$/ }),
    ]);
    await preview.click();
    await page.locator('.qpg-paper').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('heading', { name: 'Preview your paper', exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'paper-generator-stages', role, 'stage-4-draft-preview');
    await capture(page, 'paper-generator-stages', role, 'generated-draft-preview');
  });

  await scenario(browser, width, 'question-review-workbench-states', role, '/admin/question-review', async page => {
    await page.getByRole('heading', { name: 'Review questions' }).waitFor({ state: 'visible' });
    const rows = page.locator('.qr-row');
    await rows.first().waitFor({ state: 'visible', timeout: 20000 });
    await capture(page, 'question-review-workbench-states', role, 'populated-queue');

    await rows.first().locator('button.qr-expand').click();
    await rows.first().locator('.qr-detail').waitFor({ state: 'visible' });
    await capture(page, 'question-review-workbench-states', role, 'expanded-question-details');

    // Selecting shown drafts is non-destructive and reveals the bulk action bar.
    await page.locator('.qr-table-head input[type=checkbox]').check();
    await page.getByRole('region', { name: 'Selected question actions' }).waitFor({ state: 'visible' });
    await capture(page, 'question-review-workbench-states', role, 'bulk-selection');

    await page.getByRole('button', { name: 'Reject selected', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirm bulk review' }).waitFor({ state: 'visible' });
    await capture(page, 'question-review-workbench-states', role, 'reject-confirmation');
    // Leave the confirmation open for the final scenario capture; never apply it.
  });

  await scenario(browser, width, 'mcq-management-edit-state', role, '/admin/mcq-management?board=ICSE&standard=9&subject=Biology&chapter=Cells', async page => {
    await page.getByRole('heading', { name: 'Manage MCQs' }).waitFor({ state: 'visible' });
    const firstQuestion = page.locator('.mcq-list mat-expansion-panel').first();
    await firstQuestion.waitFor({ state: 'visible', timeout: 20000 });
    await capture(page, 'mcq-management-edit-state', role, 'populated-filtered-bank');

    await firstQuestion.locator('mat-expansion-panel-header').click();
    await firstQuestion.locator('.mcq-details').waitFor({ state: 'visible' });
    await capture(page, 'mcq-management-edit-state', role, 'expanded-question');

    await firstQuestion.locator('button[aria-label="Edit question"]').click();
    const updatedJson = firstQuestion.getByLabel('Updated question JSON');
    await updatedJson.waitFor({ state: 'visible' });
    await updatedJson.fill(JSON.stringify({
      question: 'Fixture edit preview: which statement describes a cell?',
      options: ['A cell is the basic unit of life', 'Cells are nonliving minerals', 'Cells occur only in animals', 'Cells have no structure'],
      correctIndex: 0,
      solutions: ['This is a local editor preview; no save action was taken.'],
    }));
    await capture(page, 'mcq-management-edit-state', role, 'question-json-edit');
    // Never click Save or Delete question.
  });

  await scenario(browser, width, 'syllabus-review-expanded-editor', role, '/syllabus-preview', async page => {
    await page.getByRole('heading', { name: 'Syllabus review' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Preview & review' }).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => undefined);
    await capture(page, 'syllabus-review-expanded-editor', role, 'subject-inventory');

    const previewButton = page.getByRole('button', { name: 'Preview & review' }).first();
    if (await previewButton.count()) {
      await previewButton.click();
      const preview = page.locator('#subject-preview');
      await preview.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
      if (await preview.isVisible().catch(() => false)) {
        await capture(page, 'syllabus-review-expanded-editor', role, 'subject-preview-open');
        const notes = preview.getByLabel('Correction and verification notes');
        if (await notes.count()) {
          await notes.fill('Fixture-only review note for visual capture.');
          await capture(page, 'syllabus-review-expanded-editor', role, 'inline-unsaved-edit');
        }
      }
    }
    // Do not save the draft, mark reviewed, or approve the syllabus.
  });

  await scenario(browser, width, 'manage-syllabus-inline-edit', role, '/admin/manage-syllabus/edit', async page => {
    await page.getByRole('combobox', { name: 'Board', exact: true }).waitFor({ state: 'visible' });
    await capture(page, 'manage-syllabus-inline-edit', role, 'syllabus-rows');
    const board = page.getByRole('combobox', { name: 'Board', exact: true });
    const boardValues = await board.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
    if (boardValues.includes('ICSE')) {
      await board.selectOption('ICSE');
      await capture(page, 'manage-syllabus-inline-edit', role, 'filtered-syllabus-rows');
    }
    const edit = page.locator('.syllabus-row:not(.header) button').first();
    if (await edit.count()) {
      await edit.click();
      await page.locator('.syllabus-row:not(.header) input').first().waitFor({ state: 'visible' });
      await capture(page, 'manage-syllabus-inline-edit', role, 'inline-row-edit');
    }
    // Do not click the check/save control.
  });
}

async function firstVisible<T extends { isVisible: () => Promise<boolean>; isEnabled: () => Promise<boolean> }>(candidates: T[]): Promise<T> {
  for (const candidate of candidates) {
    if (await candidate.isVisible() && await candidate.isEnabled()) return candidate;
  }
  throw new Error('Expected an enabled paper-generator action, but all source-confirmed controls are hidden or disabled.');
}

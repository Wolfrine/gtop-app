import type { Browser, BrowserContext, Page } from '@playwright/test';

type Scenario = (
  browser: Browser,
  width: number,
  key: string,
  role: string,
  route: string,
  action?: (page: Page, context: BrowserContext) => Promise<void>,
) => Promise<void>;
type Capture = (page: Page, key: string, role: string, state: string) => Promise<void>;

const scope = '/practice?board=CBSE&standard=12&subjects=Chemistry&chapters=Solutions&count=5';
const captureState = (capture: Capture, key: string, role: string, state: string) =>
  async (page: Page) => capture(page, key, role, state);

/** Capture additional learner journeys that need real, stateful UI interactions. */
export async function captureLearnerExtraStates(
  scenario: Scenario,
  browser: Browser,
  width: number,
  capture: Capture,
  accounts: Record<string, { uid: string; email: string }>,
): Promise<void> {
  if (!accounts.admin?.uid || !accounts.learner?.uid) {
    throw new Error('captureLearnerExtraStates requires seeded admin and learner accounts.');
  }

  // Complete the reviewed five-question invitation as an admin. Admin profiles
  // are intentionally permitted to practise the invitation curriculum even
  // though their own default curriculum is ICSE / 9.
  await scenario(
    browser,
    width,
    'invited-quiz-completion-and-return',
    'admin',
    scope,
    async (page) => {
      await page.getByRole('button', { name: 'Start five questions', exact: true }).click();
      await page.locator('.quiz-header h1 strong').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('.option-card').first().waitFor({ state: 'visible', timeout: 30000 });
      for (let i = 0; i < 5; i++) {
        await page.locator('.quiz-header h1 strong').filter({ hasText: String(i + 1) }).waitFor({ state: 'visible' });
        await page.locator('.option-card').first().click();
        await page.waitForFunction(() => document.querySelector('.option-card')?.getAttribute('aria-pressed') === 'true');
        if (i === 0) {
          await page.locator('.option-card').first().waitFor();
          await captureState(capture, 'invited-quiz-in-progress', 'admin', 'First invitation question answered')(page);
        }
        await page.getByRole('button', { name: i === 4 ? 'Submit' : 'Next', exact: true }).click();
      }
      await page.getByRole('heading', { name: 'See what clicked.' }).waitFor({ state: 'visible', timeout: 30000 });
      await page.getByText('Your result is saved in Reports.', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
      await page.getByRole('button', { name: 'Keep this practice on my dashboard', exact: true }).waitFor({ state: 'visible' });
      await captureState(capture, 'invited-quiz-saved-offer', 'admin', 'Saved five-question result and voluntary return offer')(page);

      await page.getByRole('button', { name: 'Keep this practice on my dashboard', exact: true }).click();
      await page.getByRole('button', { name: 'Back to Dashboard', exact: true }).click();
      await page.locator('app-practice-return-card').getByText('saved for tomorrow').waitFor({ state: 'visible' });
      await captureState(capture, 'invitation-dashboard-return-cue', 'admin', 'Dashboard card with invitation revisit saved for tomorrow')(page);
    },
  );

  // Exercise both clipboard outcomes from the actual dashboard dialog. The
  // failed clipboard write follows the same override used by the invitation
  // integration test and leaves the readonly link visible for manual copying.
  await scenario(
    browser,
    width,
    'practice-link-share-outcomes',
    'admin',
    '/dashboard',
    async (page, context) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4300' });
      await page.getByRole('button', { name: 'Custom Quiz', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      for (const [label, value, multiple] of [
        ['Board', 'CBSE', false],
        ['Standard', '12', false],
        ['Subjects', 'Chemistry', true],
        ['Chapters', 'Solutions', true],
      ] as const) {
        // Angular Material's generated accessible names vary between versions;
        // bind the action to the exact visible form label in this dialog.
        await dialog.locator(`mat-form-field:has(mat-label:text-is("${label}")) mat-select`).click();
        await page.getByRole('option', { name: value, exact: true }).click();
        if (multiple) await page.keyboard.press('Escape');
      }
      await dialog.locator('mat-form-field:has(mat-label:text-is("Number of Questions")) input[type="number"]').fill('5');
      const copy = dialog.getByRole('button', { name: 'Copy practice link', exact: true });
      await copy.waitFor({ state: 'visible' });
      await copy.click();
      const shareStatus = dialog.locator('app-practice-share [role=status]');
      await shareStatus.filter({ hasText: 'Practice link copied' }).waitFor({ state: 'visible' });
      await captureState(capture, 'practice-link-copied', 'admin', 'Practice invitation link copied to clipboard')(page);

      await page.evaluate(() => {
        navigator.clipboard.writeText = async () => {
          throw new DOMException('QA clipboard unavailable', 'NotAllowedError');
        };
      });
      await copy.click();
      await shareStatus.filter({ hasText: 'Select the link below' }).waitFor({ state: 'visible' });
      const manualLink = dialog.getByLabel('Practice link', { exact: true });
      await manualLink.waitFor({ state: 'visible' });
      await dialog.locator('input[readonly]').waitFor({ state: 'visible' });
      await captureState(capture, 'practice-link-manual-fallback', 'admin', 'Clipboard denied; readonly link available for manual copying')(page);
    },
  );

  // The fixture has three correct and two incorrect answers on result-0.
  await scenario(
    browser,
    width,
    'quiz-summary-incorrect-filter',
    'learner',
    `/quiz-summary?sessionId=baseline-20261009-result-0&userId=${encodeURIComponent(accounts.learner.uid)}`,
    async (page) => {
      await page.getByRole('heading', { name: 'See what clicked.' }).waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('mat-expansion-panel').first().waitFor({ state: 'visible' });
      await captureState(capture, 'quiz-summary-all-answers', 'learner', 'Saved result with all five questions before filtering')(page);
      await page.getByRole('button', { name: /Show only incorrect/ }).click();
      await page.waitForFunction(() => document.querySelectorAll('mat-expansion-panel').length === 2);
      await captureState(capture, 'quiz-summary-incorrect-only', 'learner', 'Review filtered to the two incorrect answers')(page);
    },
  );

  // Run mode uses the active LiveSessions fixture and its ordered questions.
  // A selection is captured only when the visible option actually becomes
  // selected; if the seeded schedule has not reached its start time yet, the
  // question view is still captured and the UI correctly rejects the answer.
  await scenario(
    browser,
    width,
    'quiz-run-active-question',
    'learner',
    '/quiz?mode=run&sessionId=baseline-20261009-run-active',
    async (page) => {
      await page.locator('.quiz-header h1').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('.question-card').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('.option-card').first().waitFor({ state: 'visible', timeout: 30000 });
      const selectedOption = page.locator('.option-card[aria-pressed="true"]');
      if (await selectedOption.count()) {
        // The desktop pass may already have submitted this shared learner's
        // answer. Capture that same submitted state for mobile without trying
        // to click the frozen option again.
        await captureState(capture, 'quiz-run-answer-submitted', 'learner', 'Run answer submitted and option locked')(page);
      } else {
        await captureState(capture, 'quiz-run-active-question', 'learner', 'Active collaborative run question with timer')(page);
        const firstOption = page.locator('.option-card').first();
        if (!(await firstOption.isDisabled())) {
          await firstOption.click();
          await page.waitForFunction(() => document.querySelector('.option-card[aria-pressed="true"]') !== null);
          await captureState(capture, 'quiz-run-answer-submitted', 'learner', 'Run answer submitted and option locked')(page);
        }
      }
    },
  );
}

import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

type Scenario = (
  browser: Browser,
  width: number,
  key: string,
  role: 'admin' | 'learner',
  route: string,
  action?: (page: Page, context: BrowserContext) => Promise<void>,
) => Promise<void>;
type Capture = (page: Page, key: string, role: string, state: string) => Promise<void>;

const role: 'learner' = 'learner';
const clickFirstChoice = async (root: Locator) =>
  root.locator('label.choice').first().click();
const waitForPlantPractice = async (page: Page) => {
  await page.locator('footer.pl-footnote details summary').click();
  await page.getByRole('button', { name: 'Explore without saving', exact: true }).click();
  // The status remains in the DOM on mobile, where its desktop-only nav slot
  // is hidden by CSS. Attachment confirms the practice transition at both widths.
  await page.locator('.pl-save-state').filter({ hasText: 'Practice mode' }).waitFor({ state: 'attached' });
};
const captureState = (capture: Capture, key: string, state: string) =>
  async (page: Page) => capture(page, key, role, state);
const setRangeValue = async (page: Page, name: string, id: string, target: number, unit: string) => {
  const slider = page.getByRole('slider', { name });
  await slider.waitFor({ state: 'visible' });
  let value = Number(await slider.inputValue());
  await slider.focus();
  while (value !== target) {
    const previous = value;
    await slider.press(target > value ? 'ArrowRight' : 'ArrowLeft');
    value = Number(await slider.inputValue());
    if (value === previous + (target > previous ? 1 : -1)) continue;
    throw new Error(`${name} slider did not move one step toward ${target}; current value is ${value}.`);
  }
  // Leave the native control so Angular's change/blur bindings are settled
  // before checking that the visible target unlocked the observation action.
  await page.keyboard.press('Tab');
  if (Number(await slider.inputValue()) !== target) {
    throw new Error(`${name} did not retain target value ${target} after blur.`);
  }
  await page.locator(`label[for="${id}"] strong`).filter({ hasText: new RegExp(`^${target} ${unit}$`) }).waitFor({ state: 'visible' });
  await waitForRecordEnabled(page, `${name} reached ${target}, but the experiment target did not enable Record observation.`);
};
const waitForRecordEnabled = async (page: Page, errorMessage: string) => {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('.observation-panel button.primary-button');
    return !!button && !button.disabled;
  }, null, { timeout: 12000 }).catch(() => { throw new Error(errorMessage); });
};

/**
 * Capture the public learner-facing lab routes through real browser controls.
 * Lesson attempts use each lab's explicit practice mode, so the walkthrough
 * does not write learner history to Firestore. The caller's scenario wrapper
 * records any timeout in its normal failure manifest.
 */
export async function captureLabStates(
  scenario: Scenario,
  browser: Browser,
  width: number,
  capture: Capture,
  accounts: Record<string, { uid: string; email: string }>,
): Promise<void> {
  // Keep the accounts argument in the public helper contract used by the root
  // runner; scenario() performs the emulator login from this role's account.
  if (!accounts[role]) throw new Error(`Missing isolated ${role} capture account`);

  await scenario(browser, width, 'plant-lab-journey', role, '/learning-lab/plants', async (page) => {
    await page.locator('main.plant-lab').waitFor();
    await page.locator('nav.pl-trail').waitFor();
    await waitForPlantPractice(page);
    await captureState(capture, 'plant-mission-01-anatomy', 'Flower anatomy exploration')(page);

    // Mission 1: open the flower, inspect its pollen maker and ovule holder.
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.getByRole('button', { name: 'Inspect Anther', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.pl-small-progress span.found').length >= 1);
    await page.getByRole('button', { name: 'Inspect Ovary', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.pl-small-progress span.found').length === 2);
    // Once the queued practice writes settle, the completion copy replaces the
    // transient instruction. Wait on the next action rather than stale prose.
    await page.locator('.pl-action-bar button.pl-primary').filter({ hasText: 'Carry some pollen' }).waitFor();
    await page.locator('.pl-action-bar button.pl-primary').click();

    // Mission 2: compatible pollen reaches a stigma. Capture the discoveries map
    // and notebook as distinct visual states before continuing the journey.
    await page.locator('.pl-current-stop').filter({ hasText: 'Deliver the pollen' }).waitFor();
    await captureState(capture, 'plant-mission-02-pollination', 'Pollination controls before a trial')(page);
    await page.locator('.pl-current-stop').click();
    await page.locator('nav.pl-map').waitFor();
    await captureState(capture, 'plant-journey-map', 'Five-stop journey map open')(page);
    await page.locator('.pl-current-stop').click();
    await page.getByRole('button', { name: 'Another plant of the same species' }).click();
    await page.getByRole('button', { name: 'Try the stigma', exact: true }).click();
    await page.locator('.pl-action-bar button.pl-primary').filter({ hasText: 'Follow the pollen' }).waitFor();
    await page.locator('.pl-notebook-button').click();
    await page.locator('aside.pl-notebook').waitFor();
    await captureState(capture, 'plant-discoveries-notebook', 'Notebook open with a compatible pollination trial')(page);
    await page.getByRole('button', { name: 'Close discoveries' }).click();
    await page.locator('.pl-action-bar button.pl-primary').click();

    // Mission 3: follow the pollen tube through four events to fertilisation.
    await page.locator('.pl-current-stop').filter({ hasText: 'A journey within' }).waitFor();
    await captureState(capture, 'plant-mission-03-fertilisation', 'Fertilisation sequence at its first event')(page);
    for (let i = 0; i < 3; i++) await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-event-list li').nth(3).waitFor();
    await page.locator('.pl-action-bar button.pl-primary').filter({ hasText: 'Watch a fruit form' }).waitFor();
    await page.locator('.pl-action-bar button.pl-primary').click();

    // Mission 4: move from flower to seed, then release a fruit in a breeze.
    await page.locator('.pl-current-stop').filter({ hasText: 'From flower to fruit' }).waitFor();
    await captureState(capture, 'plant-mission-04-fruit', 'Fruit development before wind dispersal')(page);
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.getByRole('button', { name: 'Breeze' }).click();
    await page.getByRole('button', { name: /Release a fruit/ }).click();
    await page.locator('.pl-action-bar button.pl-primary').filter({ hasText: 'Try another way to grow' }).waitFor();
    await page.locator('.pl-action-bar button.pl-primary').click();

    // Mission 5: compare tubers with and without a bud, then plant a leaf bud.
    await page.locator('.pl-current-stop').filter({ hasText: 'Another way to grow' }).waitFor();
    await captureState(capture, 'plant-mission-05-propagation', 'Vegetative propagation controls')(page);
    const pots = page.locator('.pl-pot-options button');
    const potA = (await pots.nth(0).innerText()).includes('With an eye');
    const potB = (await pots.nth(1).innerText()).includes('With an eye');
    if (potA === potB) await pots.nth(1).click();
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('.pl-action-bar button.pl-primary').filter({ hasText: 'See my discoveries' }).waitFor();

    // Final mission completion opens the field notebook summary, then the five
    // question check and reflection form.
    await page.locator('.pl-action-bar button.pl-primary').click();
    await page.locator('section.pl-summary').waitFor();
    await captureState(capture, 'plant-discovery-summary', 'Five discoveries before the knowledge check')(page);
    await page.getByRole('button', { name: /Try five fresh situations/ }).click();
    await page.locator('section.pl-assessment').waitFor();
    await captureState(capture, 'plant-assessment', 'Five-question plant reproduction assessment')(page);
    const assessment = page.locator('section.pl-assessment');
    for (let i = 0; i < 5; i++) {
      await clickFirstChoice(assessment.locator('app-lab-choices').first());
      if (i < 4) await assessment.getByRole('button', { name: 'Next question →', exact: true }).click();
    }
    await clickFirstChoice(assessment.locator('app-lab-choices').last());
    await assessment.getByRole('button', { name: 'Check my answers →', exact: true }).click();
    await page.locator('section.pl-summary h1').filter({ hasText: 'Here is what you understood.' }).waitFor();
    await captureState(capture, 'plant-graded-summary-feedback', 'Graded summary with explanations and feedback form')(page);
    await page.getByRole('button', { name: '5 out of 5 useful', exact: true }).click();
    await page.locator('#plant-feedback').fill('The interactive journey made the sequence clear.');
    await page.locator('.pl-feedback button.pl-primary').click();
    await page.getByRole('heading', { name: 'Practice complete.' }).waitFor();
    await captureState(capture, 'plant-feedback-sent', 'Practice feedback completion state')(page);
  });

  await scenario(browser, width, 'current-lab-journey', role, '/learning-lab/current', async (page) => {
    await page.locator('main.learning-lab').waitFor();
    await page.locator('nav.step-tabs').waitFor();
    await captureState(capture, 'current-lab-predict', 'Fresh baseline predictions and lesson steps')(page);
    const baseline = page.locator('main.learning-lab app-lab-choices');
    await clickFirstChoice(baseline.nth(0));
    await clickFirstChoice(baseline.nth(1));
    await page.getByRole('button', { name: 'Try without saving', exact: true }).click();
    await page.locator('.lab-layout').waitFor();
    await captureState(capture, 'current-lab-single-circuit', 'Single-resistor circuit controls')(page);

    // Experiment 1 — increase voltage to 12 V while keeping 6 Ω resistance.
    await clickFirstChoice(page.locator('.prediction-strip app-lab-choices'));
    await setRangeValue(page, 'Battery voltage in volts', 'voltage-control', 12, 'V');
    await captureState(capture, 'current-lab-voltage-result', 'Voltage changed with live current reading')(page);
    await page.getByRole('button', { name: 'Record observation ✓', exact: true }).click();
    await page.locator('.observation-panel.completed').waitFor();
    await page.getByRole('button', { name: 'Next experiment →', exact: true }).click();

    // Experiment 2 — double resistance at fixed voltage.
    await page.locator('.experiment-top h2').filter({ hasText: 'Make the path harder' }).waitFor();
    await clickFirstChoice(page.locator('.prediction-strip app-lab-choices'));
    await setRangeValue(page, 'Resistance R1 in ohms', 'r1-control', 12, 'Ω');
    await captureState(capture, 'current-lab-resistance-result', 'Resistance change and current reading')(page);
    await page.getByRole('button', { name: 'Record observation ✓', exact: true }).click();
    await page.locator('.observation-panel.completed').waitFor();
    await page.getByRole('button', { name: 'Next experiment →', exact: true }).click();

    // Experiment 3 starts in series mode. Switch to parallel at 6 V / 6 Ω / 6 Ω.
    await page.locator('.experiment-top h2').filter({ hasText: 'Give current another path' }).waitFor();
    await clickFirstChoice(page.locator('.prediction-strip app-lab-choices'));
    await captureState(capture, 'current-lab-series-circuit', 'Two-resistor series circuit before changing arrangement')(page);
    await page.locator('.mode-selector label').filter({ hasText: 'Parallel' }).click();
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('.mode-selector input[type="radio"][value="parallel"]')?.checked === true);
    await waitForRecordEnabled(page, 'Selecting Parallel did not reach the third experiment target.');
    await captureState(capture, 'current-lab-parallel-circuit', 'Parallel circuit with branch current and voltage values')(page);
    await page.getByRole('button', { name: 'Record observation ✓', exact: true }).click();
    await page.locator('.observation-panel.completed').waitFor();
    await page.getByRole('button', { name: 'Check understanding →', exact: true }).click();
    await page.locator('.check-layout').waitFor();
    await captureState(capture, 'current-lab-check', 'Five-question understanding check and reflection')(page);

    const check = page.locator('.check-layout');
    const questions = check.locator('.question-block app-lab-choices');
    const total = await questions.count();
    for (let i = 0; i < total; i++) await clickFirstChoice(questions.nth(i));
    await clickFirstChoice(check.locator('.confidence-question app-lab-choices'));
    await check.getByRole('button', { name: 'Check my answers →', exact: true }).click();
    await check.locator('.score-card').waitFor();
    await captureState(capture, 'current-lab-graded-reflection', 'Checked answers and usefulness feedback form')(page);
    await clickFirstChoice(check.locator('.reflection-panel app-lab-choices'));
    await check.locator('#feedback').fill('Changing one circuit variable at a time helped.');
    await check.getByRole('button', { name: 'Finish practice →', exact: true }).click();
    await page.getByText('Practice complete.', { exact: true }).waitFor();
    await captureState(capture, 'current-lab-practice-complete', 'Practice completion confirmation')(page);
  });

}

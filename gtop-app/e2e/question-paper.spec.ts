import { expect, test, type Page } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email = `paper-admin-${tag}@gtop.test`;
const password = 'GTOP-paper-test-2026';
const subject = `Paper Science ${tag}`;
// Existing practice tests intentionally use all CBSE 10 questions. Keep this
// fixture's curriculum separate so parallel browser projects cannot affect them.
const board = `E2E Paper ${tag}`;
const templateId = `paper-template-${tag}`;
const draftId = `review-draft-${tag}`;
const priorityId = `review-priority-${tag}`;
const syllabusId = `paper-motion-${tag}`;
// A deterministic unbroken token exercises narrow paper headings and draft rows;
// the random identifier alone could wrap at its hyphen and hide an overflow bug.
const title = `Chapter revision ${tag} AdvancedRevisionWithoutBreaksForPhoneLayoutCoverage`;
let environment: RulesTestEnvironment;
let adminUid: string;
const studentEmail = `paper-student-${tag}@gtop.test`;

test.beforeAll(async () => {
  const app = initializeApp({ apiKey: 'demo', projectId: 'gtop-app' }, `paper-${tag}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  adminUid = credential.user.uid;
  const student = await createUserWithEmailAndPassword(auth, studentEmail, password);
  environment = await initializeTestEnvironment({ projectId: 'gtop-app', firestore: { host: '127.0.0.1', port: 8080 } });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', credential.user.uid), { uid: credential.user.uid, email, displayName: 'Paper Admin', role: 'admin', board, standard: '10' });
    await setDoc(doc(db, 'users', student.user.uid), { uid: student.user.uid, email: studentEmail, displayName: 'Learner', role: 'user', board, standard: '10' });
    await setDoc(doc(db, 'paperTemplates', templateId), {
      title: `Two-section template ${tag}`, board, standard: '10', subjects: [subject], status: 'active', durationMinutes: 30,
      structure: { sections: [
        { title: 'Core MCQs', questionType: 'mcq', questionCount: 2, marksPerQuestion: 1, difficulty: 'easy' },
        { title: 'Applied MCQs', questionType: 'mcq', questionCount: 2, marksPerQuestion: 2, difficulty: 'moderate' },
      ] },
    });
    await setDoc(doc(db, 'paperTemplates', 'competency_based_paper'), {name:'Competency-Based Paper', status:'active'});
    await setDoc(doc(db, 'syllabus', `alternate-${tag}`), {board:`Alternate ${board}`, standard:'9', subject, chapter:'Cells', mcqCount:0});
    for (const chapter of ['Motion', 'Energy']) {
      await setDoc(doc(db, 'syllabus', chapter === 'Motion' ? syllabusId : `paper-energy-${tag}`), { board, standard: '10', subject, chapter, mcqCount: 2 });
      for (const difficulty of ['easy', 'moderate']) {
        await setDoc(doc(db, 'questions', `${tag}-${chapter}-${difficulty}`), {
          board, standard: '10', subject, chapter, questionType: 'mcq', difficulty, status: 'approved',
          question: `${chapter} ${difficulty}: which statement is correct?`, title: `${chapter} ${difficulty}`,
          options: ['Correct statement', 'Incorrect statement'], correctIndex: 0,
          solutions: [`Explanation for ${chapter} ${difficulty}.`], flagCount: 0,
        });
      }
    }
    await setDoc(doc(db, 'devQuestions', draftId), {
      board, standard: '10', subject, chapter: 'Motion', sourceSyllabusId: syllabusId,
      sourcePriorityId: priorityId, referenceUsed: 'Motion curriculum review', referenceConfidence: 0.95,
      boardStandardCheck: { matched: true },
      questionType: 'mcq', difficulty: 'easy', reviewStatus: 'pending-admin-review',
      title: `Review sample ${tag}`, question: 'A test object moves at constant velocity. What is its acceleration?',
      options: ['Zero', 'One metre per second squared'], correctIndex: 0,
      solutions: ['Acceleration is the change in velocity per unit time; constant velocity gives zero.'],
    });
    await setDoc(doc(db, 'questionBankPriorityItems', priorityId), {
      board, standard: '10', subject, chapter: 'Motion', sourceSyllabusId: syllabusId,
      source: 'admin-question-bank-growth', status: 'open', priority: 'high', requiredCount: 1000,
      questionTypes: ['mcq', 'short_answer'],
    });
    for (let index = 0; index < 54; index++) {
      const written = index === 0;
      await setDoc(doc(db, 'devQuestions', `batch-${tag}-${String(index).padStart(2, '0')}`), {
        board, standard: '10', subject, chapter: 'Motion', sourceSyllabusId: syllabusId,
        sourcePriorityId: priorityId, referenceUsed: 'Motion curriculum review', referenceConfidence: 0.96,
        boardStandardCheck: { matched: true }, questionType: written ? 'short_answer' : 'mcq',
        difficulty: index % 3 === 0 ? 'moderate' : 'easy', marks: written ? 2 : 1,
        reviewStatus: 'pending-admin-review', status: 'dev', paperOnly: written,
        question: `Batch ${index}: how does a moving object change position in a measured time interval?`,
        title: `Motion batch ${index}`,
        options: written ? [] : ['Position changes with time', 'Time does not pass', 'Position never changes', 'Distance is always zero'],
        correctIndex: written ? -1 : 0,
        solutions: [`For batch ${index}, displacement is the change in position over the time interval.`],
      });
    }
  });
  await deleteApp(app);
});

test.afterAll(async () => environment?.cleanup());

async function openAdmin(page: Page, route: string) {
  const url = new URL(route, 'http://127.0.0.1:4300');
  url.searchParams.set('emulator', '1');
  url.searchParams.set('testEmail', email);
  url.searchParams.set('testPassword', password);
  await page.goto(url.pathname + url.search);
}

test('the current discovery landing works and admin sign-in retains the paper route', async ({ page }, testInfo) => {
  await page.goto('/?emulator=1');
  await expect(page.getByRole('heading', { name: /A little practice.*bigger world/i })).toBeVisible();
  await expect(page.locator('.discovery-hero__art')).toBeVisible();
  await expect.poll(() => page.locator('.discovery-hero__art').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('app-side-nav')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('current-landing.png'), fullPage: true });
  await page.goto('/admin/question-paper-generator?emulator=1');
  await expect(page.getByRole('heading', { name: /A little practice.*bigger world/i })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/admin/question-paper-generator?emulator=1');
  await page.getByRole('button', { name: 'Sign in', exact: false }).first().click();
  await expect(page).toHaveURL(/profile-setup.*returnUrl/);
});

test('current admin navigation reaches both tools and preserves Learning Lab', async ({ page }) => {
  await openAdmin(page, '/admin');
  await expect(page.getByRole('heading', { name: 'Admin Console', exact: true })).toBeVisible();
  await page.locator('[aria-label="Question bank tools"]').getByRole('link', { name: 'Question papers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Question papers', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Bank', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/question-library$/);
  await expect(page.getByRole('heading', { name: 'Question bank', exact: true })).toBeVisible();
  await openAdmin(page, '/learning-lab');
  await expect(page.getByRole('heading', { name: 'Learning Lab.', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Plant Reproduction →', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Current Lab →', exact: true })).toBeVisible();
});

test('learner accounts cannot open either admin module', async ({ page }) => {
  for (const route of ['/admin/question-paper-generator', '/admin/question-review']) {
    await page.goto(`${route}?emulator=1&testEmail=${encodeURIComponent(studentEmail)}&testPassword=${encodeURIComponent(password)}`);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('app-question-paper-generator-page, app-question-review')).toHaveCount(0);
    await expect(page.locator('app-side-nav a[href="/admin/question-paper-generator"]')).toHaveCount(0);
  }
});

test('admin sees a chapter request, exact coverage and the independent question bank', async ({ page }, testInfo) => {
  await openAdmin(page, `/admin/question-bank?priorityId=${priorityId}`);
  await expect(page.getByRole('heading', { name: 'Question requests', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Motion', exact: true })).toBeVisible();
  await expect(page.getByText('55', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review its drafts' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('priority-coverage.png'), fullPage: true });
  await page.getByRole('spinbutton', { name: 'Approved target' }).fill('1200');
  await page.getByRole('button', { name: 'Save priority' }).click();
  await expect(page.getByText('Priority saved.', { exact: false })).toBeVisible();
  await environment.withSecurityRulesDisabled(async context => {
    expect((await getDoc(doc(context.firestore(), 'questionBankPriorityItems', priorityId))).data())
      .toMatchObject({ requiredCount: 1200, gapCount: 1198, generationDeficit:1143, status: 'open' });
  });
  await page.getByRole('link', { name: 'Bank', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Question bank',exact:true })).toBeVisible();
  await page.getByLabel('Board',{exact:true}).selectOption(board);
  await page.getByLabel('Class',{exact:true}).selectOption('10');
  await page.getByLabel('Subject',{exact:true}).selectOption(subject);
  if(await page.locator('.qm-mobile-chapter').isVisible())await page.getByLabel('Chapter',{exact:true}).selectOption(syllabusId);
  else await page.locator('.qm-chapters').getByRole('button',{name:'Motion',exact:true}).click();
  await expect(page.locator('.qm-question')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('approved-bank.png'), fullPage: true });
  await page.getByRole('button',{name:/Add written question/}).click();
  await page.getByLabel('Question',{exact:true}).fill('Explain two ways to measure acceleration in this experimental setup '+tag);
  await page.getByLabel('Answer / worked solution').fill('Measure velocity at two instants; divide the velocity change by elapsed time.');
  await page.getByRole('button',{name:'Save question',exact:true}).click();
  await expect(page.getByText('Question saved in the approved bank.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Written \/ paper/}).click();
  await expect(page.locator('.qm-question')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({path:testInfo.outputPath('written-bank.png'),fullPage:true});
});

async function expectNoHorizontalOverflow(page: Page) {
  const readLayout = () => page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      fontsLoaded: document.fonts.status === 'loaded',
      activeAnimations: document.getAnimations().filter(animation =>
        (animation.playState === 'running' || animation.pending) &&
        Number.isFinite(animation.effect?.getComputedTiming().endTime),
      ).map(animation => ({
        name: (animation as CSSAnimation).animationName ?? animation.constructor.name,
        playState: animation.playState,
      })),
      overflowingElements: Array.from(document.querySelectorAll('body *')).flatMap(element => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > innerWidth || box.left < 0) ? [{
          element: element.tagName.toLowerCase(), className: element.getAttribute('class'),
          left: box.left, right: box.right, text: element.textContent?.trim().slice(0, 100),
        }] : [];
      }).slice(0, 12),
    }));
  let latest: Awaited<ReturnType<typeof readLayout>> | undefined;
  let previousDimensions = '';
  let stableSamples = 0;
  // The saved view inserts cards with a 480ms rise transform and staggered delays.
  // The trace checks geometry ~63ms after insertion, while those animations run.
  // A CI WebKit attempt reported a 406px scroll extent against a 390px viewport
  // with every element's bounds inside it; its retry and the UAT run fitted.
  // Check settled geometry, including actual animation state, rather than relaxing
  // the width requirement or disabling the application's motion to pass the test.
  try {
    await expect.poll(async () => {
      latest = await readLayout();
      const dimensions = JSON.stringify([
        latest.documentWidth, latest.documentHeight, latest.viewportWidth, latest.viewportHeight,
      ]);
      const fits = latest.documentWidth <= latest.viewportWidth;
      const settled = latest.fontsLoaded && latest.activeAnimations.length === 0;
      stableSamples = fits && settled && dimensions === previousDimensions ? stableSamples + 1 : 0;
      previousDimensions = dimensions;
      return stableSamples >= 2;
    }, { message: 'The rendered page must settle within the viewport.', timeout: 5_000,
      intervals: [50, 100, 250] }).toBe(true);
  } catch (error) {
    throw new Error(`${String(error)}\nLast layout: ${JSON.stringify(latest, null, 2)}`);
  }
}

test('admin can prepare, print, save and reopen an exact paper, then request missing questions', async ({ page }, testInfo) => {
  await openAdmin(page, '/admin/question-paper-generator');
  await expect(page.getByRole('heading', { name: 'Create a question paper', exact: true })).toBeVisible();
  const compact = true;
  if (compact) {
    await expect(page.getByRole('heading', { name: 'Choose what to cover' })).toBeHidden();
    await page.locator('.qpg-format-option').filter({ hasText: `Two-section template ${tag}` }).click();
    await expect(page.getByRole('heading', { name: 'Choose what to cover' })).toBeVisible();
    await expect(page.locator('.qpg-format-grid')).toBeHidden();
    await expect(page.locator('.qpg-example')).toBeHidden();
    await page.getByRole('button', { name: 'View sample', exact: true }).click();
    await expect(page.locator('.qpg-example')).toBeVisible();
    await page.getByRole('button', { name: 'Hide sample', exact: true }).click();
  }
  await expect(page.getByRole('checkbox', { name: subject, exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('checkbox', { name: subject, exact: true }).check();
  await page.getByRole('checkbox', { name: 'Motion', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Energy', exact: true }).check();
  if (!compact) await page.locator('.qpg-format-option').filter({ hasText: `Two-section template ${tag}` }).click();
  await expect(page.getByLabel('Marks', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('Duration minutes', { exact: true })).toHaveValue('30');
  await page.getByLabel('Paper title', { exact: true }).fill(title);
  if (compact) await page.screenshot({ path: testInfo.outputPath('mobile-selected-setup.png'), fullPage: true });
  await page.getByRole('button', { name: 'Check availability', exact: true }).click();
  await expect(page.getByText('Ready to prepare', { exact: true })).toBeVisible();
  if (compact) {
    await expect(page.getByRole('heading', { name: 'Choose what to cover' })).toBeHidden();
    await expect(page.locator('.qpg-mobile-bar')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('mobile-coverage.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Preview paper', exact: true }).click();
  await expect(page.locator('.qpg-question-list > li')).toHaveCount(4);
  for (const chapter of ['Motion', 'Energy']) {
    for (const difficulty of ['easy', 'moderate']) {
      await expect(page.locator('.qpg-paper').getByText(`${chapter} ${difficulty}: which statement is correct?`, { exact: false })).toHaveCount(1);
    }
  }
  const printPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Print paper / Save PDF', exact: true }).click();
  const studentPaper = await printPopup;
  await expect(studentPaper.getByRole('heading', { name: title })).toBeVisible();
  await expect(studentPaper.getByText('Explanation for Motion easy.', { exact: true })).toHaveCount(0);
  await studentPaper.close();
  const keyPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Print answer key', exact: true }).click();
  const answerKey = await keyPopup;
  await expect(answerKey.getByText('Explanation for Motion easy.', { exact: true })).toBeVisible();
  await answerKey.close();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Your draft is saved. Reopen it from Saved papers.', { exact: true })).toBeVisible();
  await environment.withSecurityRulesDisabled(async context => {
    const drafts = await getDocs(query(collection(context.firestore(), 'paperDrafts'), where('title', '==', title)));
    expect(drafts.size).toBe(1);
    const data = drafts.docs[0].data();
    expect(data.actualMarks).toBe(6);
    expect(data.coverage.gapCount).toBe(0);
    expect(new Set(data.sections.flatMap((section: { questions: { questionId: string }[] }) => section.questions.map(q => q.questionId))).size).toBe(4);
    // Prove reopening uses the saved question snapshot, even after a bank edit.
    await setDoc(doc(context.firestore(), 'questions', `${tag}-Motion-easy`), { question: 'Edited after saving the paper.' }, { merge: true });
  });
  await page.reload();
  if (compact) await page.getByRole('button', { name: 'Saved papers', exact: true }).click();
  const savedRow = page.locator('.qpg-draft-row').filter({ hasText: title });
  await savedRow.getByRole('button', { name: 'Open draft', exact: true }).click();
  await expect(page.getByText('Saved paper opened', { exact: true })).toBeVisible();
  await expect(page.locator('.qpg-paper').getByText('Motion easy: which statement is correct?', { exact: false })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (compact) {
    await expect(page.getByRole('heading', { name: 'Choose what to cover' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Check the question bank' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Recent drafts' })).toBeHidden();
  }
  await page.getByRole('heading', { name: 'Create a question paper', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('saved-paper.png'), fullPage: true });
  await page.getByRole('button', { name: 'Use setup for a new paper', exact: true }).click();
  if (compact) await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.locator('.qpg-format-option[data-template-id="auto"]').click();
  await page.getByLabel('Marks', { exact: true }).fill('8');
  await expect(page.locator('.qpg-paper')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check availability', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Questions still needed', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Request missing questions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Questions requested', exact: true })).toBeDisabled();
  await environment.withSecurityRulesDisabled(async context => {
    const requests = await getDocs(query(collection(context.firestore(), 'questionBankPriorityItems'),
      where('subject', '==', subject), where('source', '==', 'admin-question-paper-generator')));
    expect(requests.size).toBe(2);
    expect(requests.docs.reduce((sum, item) => sum + item.data().gapCount, 0)).toBe(4);
  });
  await page.getByRole('link',{name:'Papers',exact:true}).click();
  const requestRow=page.locator('.qm-paper-row').filter({has:page.getByRole('link',{name:'Check & continue'})}).filter({hasText:title});
  await expect(requestRow).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({path:testInfo.outputPath('papers-home.png'),fullPage:true});
  await requestRow.getByRole('link',{name:'Check & continue'}).click();
  await expect(page.getByLabel('Marks',{exact:true})).toHaveValue('8');
  await expect(page.getByRole('checkbox',{name:'Motion',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Check availability',exact:true}).click();
  await expect(page.getByRole('button',{name:'Questions requested',exact:true})).toBeDisabled();
  await expect.poll(async()=>{let count=0;await environment.withSecurityRulesDisabled(async context=>{
    const sessions=await getDocs(query(collection(context.firestore(),'adminUsageSessions'),where('actorUid','==',adminUid)));
    count=sessions.docs.reduce((sum,d)=>sum+Number(d.data().eventCounts?.['paper-builder__paper_requested']??0),0);
  });return count;}).toBeGreaterThan(0);
  await page.getByRole('link',{name:'Papers',exact:true}).click();
  await requestRow.getByRole('button',{name:'Cancel request',exact:true}).click();
  await requestRow.getByRole('button',{name:'Confirm cancellation',exact:true}).click();
  await expect(requestRow).toHaveCount(0);
  await environment.withSecurityRulesDisabled(async context=>{
    const requests=await getDocs(query(collection(context.firestore(),'questionBankPriorityItems'),where('subject','==',subject),where('source','==','admin-question-paper-generator')));
    expect(requests.size).toBe(2);
    expect(requests.docs.every(d=>d.data().status==='paused')).toBe(true);
    expect((await getDoc(doc(context.firestore(),'paperRequests',requests.docs[0].data().parentRequestId))).data()?.status).toBe('cancelled');
  });
});

test('admin review publishes an edited draft and increments its exact syllabus count once', async ({ page }, testInfo) => {
  await openAdmin(page, `/admin/question-review?priorityId=${priorityId}`);
  await expect(page.getByRole('heading', { name: 'Review questions', exact: true })).toBeVisible();
  await expect(page.getByText('awaiting review', { exact: false }).first()).toBeVisible();
  await expect(page.locator('.qr-row')).toHaveCount(50);
  await page.getByRole('button', { name: 'Load next 50 questions' }).click();
  await expect(page.locator('.qr-row')).toHaveCount(55);
  const sample = page.locator('.qr-row').filter({ hasText: 'A test object moves at constant velocity' });
  await sample.getByRole('button', { name: 'Details' }).click();
  await sample.getByRole('button', { name: 'Edit or decide this question' }).click();
  await page.getByLabel('Title', { exact: true }).fill(`Approved sample ${tag}`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(`Approved sample ${tag}`);
  await expect(page.getByRole('button', { name: 'Approve edited question' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('heading', { name: 'Review questions', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('question-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Approve edited question' }).click();
  await expect(page.getByText('Edited question approved.', { exact: true })).toBeVisible();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const published = await getDoc(doc(db, 'questions', draftId));
    expect(published.data()?.title).toBe(`Approved sample ${tag}`);
    expect(published.data()?.status).toBe('approved');
    expect((await getDoc(doc(db, 'syllabus', syllabusId))).data()?.mcqCount).toBe(3);
    expect((await getDoc(doc(db, 'devQuestions', draftId))).data()?.reviewStatus).toBe('approved');
  });
  await page.reload();
  await expect(page.locator('.qr-row').filter({ hasText: 'A test object moves at constant velocity' })).toHaveCount(0);
});

test('admin can select a loaded page and bulk approve objective and written questions', async ({ page }, testInfo) => {
  await openAdmin(page, `/admin/question-review?priorityId=${priorityId}`);
  await expect(page.locator('.qr-row')).toHaveCount(50);
  await page.getByRole('checkbox', { name: 'Select shown' }).check();
  await expect(page.getByText('50 selected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve 50' })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('bulk-review-selected.png'), fullPage: true });
  // Keep the cross-device test bounded while exercising both publishing destinations.
  await page.getByRole('checkbox', { name: 'Select shown' }).uncheck();
  await expect(page.locator('.qr-selection')).toHaveCount(0);
  const written = page.locator('.qr-row').filter({ hasText: 'Batch 0: how does a moving object' });
  const objective = page.locator('.qr-row').filter({ hasText: 'Batch 1: how does a moving object' });
  await written.locator('input[type="checkbox"]').check();
  await objective.locator('input[type="checkbox"]').check();
  await expect(page.locator('.qr-selection')).toContainText('1 quiz & paper · 1 paper only');
  await page.getByRole('button', { name: 'Approve 2' }).click();
  await expect(page.getByRole('heading', { name: 'Approve 2 questions?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm approve' }).click();
  await expect(page.getByText('2 approved; 0 need attention.')).toBeVisible();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    expect((await getDoc(doc(db, 'devQuestions', `batch-${tag}-00`))).data()?.reviewStatus).toBe('approved-paper-only');
    expect((await getDoc(doc(db, 'questions', `batch-${tag}-00`))).exists()).toBe(false);
    expect((await getDoc(doc(db, 'questions', `batch-${tag}-01`))).data()?.status).toBe('approved');
  });
});


test('competency pattern survives syllabus changes and resizing total marks', async ({page}, testInfo) => {
  await openAdmin(page, '/admin/question-paper-generator');
  await page.locator('[data-template-id="competency_based_paper"]').click();
  await expect(page.getByLabel('Marks', {exact:true})).toBeEditable();
  await page.getByLabel('Board', {exact:true}).selectOption(`Alternate ${board}`);
  await page.getByLabel('Standard', {exact:true}).selectOption('9');
  await page.locator('.qpg-chip').filter({hasText:subject}).click();
  await page.getByLabel('Marks', {exact:true}).fill('80');
  await page.getByLabel('Duration minutes', {exact:true}).click();
  const sectionPlan = page.locator('.qpg-plan');
  if ((await sectionPlan.getAttribute('open')) === null) await sectionPlan.locator('summary').click();
  await expect(page.locator('.qpg-rule-row')).toHaveCount(4);
  await expect(page.getByLabel('Concept check question count')).toHaveValue('20');
  await expect(page.getByLabel('Apply & explain question count')).toHaveValue('8');
  await expect(page.getByLabel('Case or source question count')).toHaveValue('6');
  await expect(page.getByLabel('Interpret an experiment question count')).toHaveValue('4');
  await expect(sectionPlan).toContainText('Short answer');
  await expect(sectionPlan).toContainText('Case based');
  await page.getByLabel('Marks', {exact:true}).fill('5');
  await page.getByLabel('Duration minutes', {exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('at least 11');
  await expect(page.locator('.qpg-rule-row')).toHaveCount(4);
  await page.getByLabel('Marks', {exact:true}).fill('41');
  await page.getByLabel('Duration minutes', {exact:true}).click();
  await expect(sectionPlan.locator('summary')).toContainText('41 marks');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('competency-pattern-preserved.png'), fullPage:true});
});

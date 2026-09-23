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
const syllabusId = `paper-motion-${tag}`;
// A deterministic unbroken token exercises narrow paper headings and draft rows;
// the random identifier alone could wrap at its hyphen and hide an overflow bug.
const title = `Chapter revision ${tag} AdvancedRevisionWithoutBreaksForPhoneLayoutCoverage`;
let environment: RulesTestEnvironment;

test.beforeAll(async () => {
  const app = initializeApp({ apiKey: 'demo', projectId: 'gtop-app' }, `paper-${tag}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  environment = await initializeTestEnvironment({ projectId: 'gtop-app', firestore: { host: '127.0.0.1', port: 8080 } });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', credential.user.uid), { uid: credential.user.uid, email, displayName: 'Paper Admin', role: 'admin', board, standard: '10' });
    await setDoc(doc(db, 'paperTemplates', templateId), {
      title: `Two-section template ${tag}`, board, standard: '10', subjects: [subject], status: 'active', durationMinutes: 30,
      structure: { sections: [
        { title: 'Core MCQs', questionType: 'mcq', questionCount: 2, marksPerQuestion: 1, difficulty: 'easy' },
        { title: 'Applied MCQs', questionType: 'mcq', questionCount: 2, marksPerQuestion: 2, difficulty: 'moderate' },
      ] },
    });
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
      questionType: 'mcq', difficulty: 'easy', reviewStatus: 'pending-admin-review',
      title: `Review sample ${tag}`, question: 'A test object moves at constant velocity. What is its acceleration?',
      options: ['Zero', 'One metre per second squared'], correctIndex: 0,
      solutions: ['Acceleration is the change in velocity per unit time; constant velocity gives zero.'],
    });
  });
  await deleteApp(app);
});

test.afterAll(async () => environment?.cleanup());

async function openAdmin(page: Page, route: string) {
  await page.goto(`${route}?emulator=1&testEmail=${encodeURIComponent(email)}&testPassword=${encodeURIComponent(password)}`);
}

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    overflowingElements: Array.from(document.querySelectorAll('body *')).flatMap(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && (box.right > innerWidth || box.left < 0) ? [{
        element: element.tagName.toLowerCase(), className: element.getAttribute('class'),
        left: box.left, right: box.right, text: element.textContent?.trim().slice(0, 100),
      }] : [];
    }).slice(0, 12),
  }));
  expect(layout.documentWidth, JSON.stringify(layout, null, 2)).toBeLessThanOrEqual(layout.viewportWidth);
}

test('admin can prepare, print, save and reopen an exact paper, then request missing questions', async ({ page }, testInfo) => {
  await openAdmin(page, '/admin/question-paper-generator');
  await expect(page.getByRole('heading', { name: 'Question paper generator', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: subject, exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('checkbox', { name: subject, exact: true }).check();
  await page.getByRole('checkbox', { name: 'Motion', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Energy', exact: true }).check();
  await page.getByLabel('Template', { exact: true }).selectOption(templateId);
  await expect(page.getByLabel('Marks', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('Duration minutes', { exact: true })).toHaveValue('30');
  await page.getByLabel('Paper title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Check availability', exact: true }).click();
  await expect(page.getByText('Ready to prepare', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Your draft is saved. Reopen it from Recent drafts below.', { exact: true })).toBeVisible();
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
  const savedRow = page.locator('.qpg-draft-row').filter({ hasText: title });
  await savedRow.getByRole('button', { name: 'Open draft', exact: true }).click();
  await expect(page.getByText('Saved paper opened', { exact: true })).toBeVisible();
  await expect(page.locator('.qpg-paper').getByText('Motion easy: which statement is correct?', { exact: false })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('heading', { name: 'Question paper generator', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('saved-paper.png'), fullPage: true });
  await page.getByRole('button', { name: 'Use setup for a new paper', exact: true }).click();
  await page.getByLabel('Template', { exact: true }).selectOption('auto');
  await page.getByLabel('Marks', { exact: true }).fill('8');
  await expect(page.locator('.qpg-paper')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check availability', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Questions still needed', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Request missing questions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Questions requested', exact: true })).toBeDisabled();
  await environment.withSecurityRulesDisabled(async context => {
    const requests = await getDocs(query(collection(context.firestore(), 'questionBankPriorityItems'), where('subject', '==', subject)));
    expect(requests.size).toBe(2);
    expect(requests.docs.reduce((sum, item) => sum + item.data().gapCount, 0)).toBe(4);
  });
});

test('admin review publishes an edited draft and increments its exact syllabus count once', async ({ page }, testInfo) => {
  await openAdmin(page, '/admin/question-review');
  await expect(page.getByRole('heading', { name: 'Review new questions', exact: true })).toBeVisible();
  await page.getByRole('button').filter({ hasText: `Review sample ${tag}` }).click();
  await page.getByLabel('Title (optional)', { exact: true }).fill(`Approved sample ${tag}`);
  await expect(page.getByLabel('Title (optional)', { exact: true })).toHaveValue(`Approved sample ${tag}`);
  await expect(page.getByRole('button', { name: 'Approve & publish', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('heading', { name: 'Review new questions', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('question-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Approve & publish', exact: true }).click();
  await expect(page.getByText('Question approved. It is now available for learner quizzes and question papers.', { exact: true })).toBeVisible();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const published = await getDoc(doc(db, 'questions', draftId));
    expect(published.data()?.title).toBe(`Approved sample ${tag}`);
    expect(published.data()?.status).toBe('approved');
    expect((await getDoc(doc(db, 'syllabus', syllabusId))).data()?.mcqCount).toBe(3);
    expect((await getDoc(doc(db, 'devQuestions', draftId))).data()?.reviewStatus).toBe('approved');
  });
  await page.reload();
  await expect(page.getByRole('button').filter({ hasText: `Review sample ${tag}` })).toHaveCount(0);
});

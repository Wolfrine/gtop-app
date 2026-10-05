import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, query, setDoc, where, Timestamp } from 'firebase/firestore';

// Unique curricula prevent concurrent suites/projects from changing this fixture.
const tag = `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const board = `Learner ${tag}`;
const otherBoard = `Other ${tag}`;
const subject = 'Physics';
const chapter = 'Motion';
const password = 'GTOP-isolated-practice-2026';
const accounts: Record<string, { email: string; uid: string }> = {};
let environment: RulesTestEnvironment;

test.beforeAll(async () => {
  const app = initializeApp({ apiKey: 'demo', projectId: 'gtop-app' }, tag);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  environment = await initializeTestEnvironment({ projectId: 'gtop-app', firestore: { host: '127.0.0.1', port: 8080 } });
  for (const name of ['learner', 'admin', 'missing', 'empty', 'alias']) {
    const email = `${name}-${tag}@gtop.test`;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    accounts[name] = { email, uid: credential.user.uid };
  }
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [name, account] of Object.entries(accounts)) {
      await setDoc(doc(db, 'users', account.uid), {
        uid: account.uid, email: account.email, displayName: `QA ${name}`,
        role: name === 'admin' ? 'admin' : 'user',
        ...(name === 'missing' ? {} : {
          board: name === 'empty' ? `Empty ${tag}` : name === 'alias' ? 'Cambridge IGCSE' : board,
          standard: name === 'alias' ? '8' : '10',
        }),
      });
    }
    for (const [scope, standard, prefix] of [[board, '10', 'own'], [otherBoard, '8', 'other']] as const) {
      await setDoc(doc(db, 'syllabus', `${tag}-${prefix}`), { board: scope, standard, subject, chapter, mcqCount: 2 });
      for (let i = 0; i < 2; i++) {
        await setDoc(doc(db, 'questions', `${tag}-${prefix}-${i}`), {
          board: scope, standard, subject, chapter, questionType: 'mcq', status: 'approved', difficulty: 'easy',
          question: `${prefix === 'own' ? 'Own' : 'Other'} curriculum question ${i}: which quantity measures length?`,
          options: ['Length', 'Time', 'Mass', 'Temperature'], correctIndex: 0,
          solutions: ['Length is measured in metres.', 'This second paragraph is also reasoning.'],
        });
      }
    }
    await setDoc(doc(db, 'syllabus', `${tag}-alias`), { board: 'Cambridge IGCSE', standard: '8', subject: `${subject} ${tag}`, chapter, mcqCount: 1 });
    await setDoc(doc(db, 'questions', `${tag}-alias`), {
      board: 'IGCSE', standard: '8', subject: `${subject} ${tag}`, chapter, questionType: 'mcq', status: 'approved',
      question: 'Alias curriculum: which quantity measures length?', options: ['Length', 'Time'], correctIndex: 0,
      solutions: ['Length is measured in metres.'],
    });
    await setDoc(doc(db, 'QuizResults', `${tag}-historical`), {
      userId: accounts.learner.uid, userName: 'Historical learner', standard: '10', subject, chapter,
      quizType: 'quick', totalQuestions: 1, correctAnswers: 1, wrongAnswers: 0, percentage: 100,
      timestamp: Timestamp.now(), questions: [{ questionId: `${tag}-own-0`, selectedIndex: 0, correctIndex: 0, isCorrect: true }],
    });
  });
  await deleteApp(app);
});
test.afterAll(async () => environment?.cleanup());

async function open(page: Page, name: string, route = '/quiz') {
  const url = new URL(route, 'http://127.0.0.1:4300');
  url.searchParams.set('emulator', '1');
  url.searchParams.set('testEmail', accounts[name].email);
  url.searchParams.set('testPassword', password);
  await page.goto(url.pathname + url.search);
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}
async function answerAll(page: Page) {
  for (let i = 0; i < 2; i++) {
    await page.locator('.option-card').filter({ hasText: 'Length' }).click();
    await page.getByRole('button', { name: i === 1 ? 'Submit' : 'Next', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'See what clicked.' })).toBeVisible();
}
async function ownResults() {
  let data: any[] = [];
  await environment.withSecurityRulesDisabled(async context => {
    const snapshot = await getDocs(query(collection(context.firestore(), 'QuizResults'), where('userId', '==', accounts.learner.uid)));
    data = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  });
  return data;
}

test('learner quick quiz scopes to own curriculum and restores answers on reload', async ({ page }, info) => {
  await open(page, 'learner');
  await expect(page.locator('.question-card')).toContainText('Own curriculum', { timeout: 25_000 });
  await expect(page.locator('.meta-info')).toContainText(board);
  await expect(page.locator('.meta-info')).toContainText('Standard 10');
  await page.locator('.option-card').filter({ hasText: 'Length' }).click();
  await expect(page.locator('.option-card.selected')).toContainText('Length');
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));
  await page.reload();
  await expect(page.locator('.question-card')).toContainText('Own curriculum');
  const restored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));
  await info.attach('session-before-and-after-reload', { body: JSON.stringify({ before, restored }, null, 2), contentType: 'application/json' });
  await expect(page.locator('.option-card.selected')).toContainText('Length');
  const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));
  expect(after.attemptId).toBe(before.attemptId);
  expect(after.questions).toEqual(before.questions);
  await screenshot(page, info, 'learner-restored');
});

test('learner direct custom link cannot override profile and accepts scalar topic params', async ({ page }, info) => {
  await open(page, 'learner', `/quiz?board=${encodeURIComponent(otherBoard)}&standard=8&subjects=Physics&chapters=Motion&count=2`);
  await expect(page.locator('.question-card')).toContainText('Own curriculum', { timeout: 25_000 });
  await expect(page.locator('.meta-info')).toContainText(board);
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));
  expect(session.quizType).toBe('custom');
  expect(session.questions).toHaveLength(2);
  await screenshot(page, info, 'learner-custom');
});

test('admin retains explicit selection of another board and class', async ({ page }, info) => {
  await open(page, 'admin', `/quiz?board=${encodeURIComponent(otherBoard)}&standard=8&subjects=Physics&chapters=Motion&count=2`);
  await expect(page.locator('.question-card')).toContainText('Other curriculum', { timeout: 25_000 });
  await expect(page.locator('.meta-info')).toContainText(otherBoard);
  await expect(page.locator('.meta-info')).toContainText('Standard 8');
  await screenshot(page, info, 'admin-selected');
});

test('missing profile and empty curriculum have explicit recoverable states', async ({ page }, info) => {
  await open(page, 'missing');
  // The existing route guard sends incomplete profiles to the setup form.
  // The in-player missing-profile state also protects a profile changed mid-quiz.
  await expect(page.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible({ timeout: 25_000 });
  await expect(page).toHaveURL(/profile-setup/);
  await expect(page.getByRole('combobox', { name: 'Board', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnUrl')).toContain('/quiz');
  await expect(page.locator('.option-card')).toHaveCount(0);
  await screenshot(page, info, 'missing-profile');
  await open(page, 'learner');
  await expect(page.locator('.question-card')).toContainText('Own curriculum');
  try {
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', accounts.learner.uid), { board: null, standard: null }, { merge: true });
    });
    await expect(page.getByRole('heading', { name: 'Choose your curriculum' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add board and class' })).toBeVisible();
    await expect(page.locator('.option-card')).toHaveCount(0);
    await screenshot(page, info, 'profile-removed-during-quiz');
  } finally {
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', accounts.learner.uid), { board, standard: '10' }, { merge: true });
    });
  }
  await open(page, 'empty');
  await expect(page.getByRole('heading', { name: 'Quiz unavailable' })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('alert')).toContainText('No chapters with MCQs found for this curriculum.');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.locator('.option-card')).toHaveCount(0);
  await screenshot(page, info, 'empty-curriculum');
});

test('Cambridge profile and syllabus find historical IGCSE question records', async ({ page }) => {
  await open(page, 'alias', `/quiz?subjects=${encodeURIComponent(`${subject} ${tag}`)}&chapters=Motion&count=1`);
  await expect(page.locator('.question-card')).toContainText('Alias curriculum', { timeout: 25_000 });
  await expect(page.locator('.meta-info')).toContainText('IGCSE');
});

test('offline result visibly fails, retries once online and remains one acknowledged attempt', async ({ page, context }, info) => {
  await open(page, 'learner', '/quiz?subjects=Physics&chapters=Motion&count=2');
  await expect(page.locator('.question-card')).toContainText('Own curriculum', { timeout: 25_000 });
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));
  await context.setOffline(true);
  await answerAll(page);
  await expect(page.getByRole('button', { name: 'Try saving again' })).toBeVisible();
  await expect(page.getByText('Your result is saved in Reports.')).toHaveCount(0);
  expect((await ownResults()).filter(result => result.attemptId === session.attemptId)).toHaveLength(0);
  await screenshot(page, info, 'save-offline');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Try saving again' }).click();
  await expect(page.getByText('Your result is saved in Reports.')).toBeVisible({ timeout: 30_000 });
  const saved = (await ownResults()).filter(result => result.attemptId === session.attemptId);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ board, standard: '10', quizType: 'custom', correctAnswers: 2 });
  expect(saved[0].questions.every((question: any) => question.selectedIndex === 0 && question.correctIndex === 0)).toBe(true);
  await page.getByRole('button', { name: 'Q1:', exact: false }).click();
  await expect(page.locator('mat-expansion-panel').first().getByText('This second paragraph is also reasoning.', { exact: false })).toBeVisible();
  await screenshot(page, info, 'save-acknowledged');
  // Simulate a server commit whose acknowledgement was lost by the browser.
  // Reload must really retry the same ID, rather than only trust a saved flag.
  await page.evaluate(() => {
    const value = JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!);
    sessionStorage.setItem('gtop.practice-session.v1', JSON.stringify({ ...value, saved: false }));
  });
  await page.goto('/quiz-summary?emulator=1');
  await expect(page.getByText('Your result is saved in Reports.')).toBeVisible();
  const acknowledged = (await ownResults()).filter(result => result.attemptId === session.attemptId);
  expect(acknowledged).toHaveLength(1);
  expect(acknowledged[0].timestamp).toEqual(saved[0].timestamp);
  await page.getByRole('button', { name: 'Retry Entire Quiz', exact: false }).click();
  await expect(page.locator('.question-card')).toContainText('Own curriculum');
  const retry = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));
  expect(retry.attemptId).not.toBe(session.attemptId);
  expect(retry.quizType).toBe('retry');
  expect(retry.questions.every((question: any) => question.selectedIndex === null)).toBe(true);
  await answerAll(page);
  await expect(page.getByText('Your result is saved in Reports.')).toBeVisible({ timeout: 30_000 });
  const retried = (await ownResults()).filter(result => result.attemptId === retry.attemptId);
  expect(retried).toHaveLength(1);
  expect(retried[0]).toMatchObject({ quizType: 'retry', correctAnswers: 2 });
});

test('historical result without board or option order opens unchanged and does not re-save', async ({ page }, info) => {
  const countBefore = (await ownResults()).length;
  await open(page, 'learner', `/quiz-summary?sessionId=${tag}-historical&userId=${accounts.learner.uid}`);
  await expect(page.locator('.chip').filter({ hasText: 'Correct: 1' })).toBeVisible({ timeout: 25_000 });
  await page.getByRole('button', { name: 'Q1:', exact: false }).click();
  await expect(page.locator('.mcq-option').first()).toContainText('A) Length');
  await expect(page.getByText('This second paragraph is also reasoning.', { exact: false })).toBeVisible();
  expect((await ownResults()).length).toBe(countBefore);
  await screenshot(page, info, 'historical-review');
});

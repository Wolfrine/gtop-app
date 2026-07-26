import { expect, test } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const email = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@gtop.test`;
const learnerEmail = `learner-${Date.now()}-${Math.random().toString(36).slice(2)}@gtop.test`;
const password = 'GTOP-test-password-2026';
let environment: RulesTestEnvironment;

test.beforeAll(async () => {
  const app = initializeApp({ apiKey: 'demo', projectId: 'gtop-app' }, `e2e-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const adminUid = credential.user.uid;
  const learnerCredential = await createUserWithEmailAndPassword(auth, learnerEmail, password);
  environment = await initializeTestEnvironment({
    projectId: 'gtop-app',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'users', adminUid), {
      uid: adminUid,
      displayName: 'UAT Admin',
      email,
      role: 'admin',
      board: 'CBSE',
      standard: '10',
    });
    await setDoc(doc(firestore, 'users', learnerCredential.user.uid), {
      uid: learnerCredential.user.uid,
      displayName: 'Mobile Learner',
      email: learnerEmail,
      role: 'user',
      board: 'CBSE',
      standard: '10',
    });
    await setDoc(doc(firestore, 'syllabus', 'cbse-10-science-light'), {
      board: 'CBSE',
      standard: '10',
      subject: 'Science',
      chapter: 'Light',
      mcqCount: 1,
    });
    await setDoc(doc(firestore, 'questions', 'light-1'), {
      board: 'CBSE',
      standard: '10',
      subject: 'Science',
      chapter: 'Light',
      title: 'Optics',
      question: 'Which lens corrects myopia?',
      options: ['Concave', 'Convex'],
      correctIndex: 0,
      solutions: ['A concave lens diverges light.'],
      flagCount: 0,
    });
    await setDoc(doc(firestore, 'actionPlans', 'e2e-work'), {
      title: 'Admin parity verification',
      description: 'Visible to signed-in admins',
      area: 'Testing',
      owner: 'E2E',
      status: 'in-progress',
      priority: 'high',
      labels: ['e2e'],
      dependencies: [],
      acceptanceCriteria: ['Loads through browser rules'],
      sourceReferences: [],
      archived: false,
    });
  });
  await deleteApp(app);
});

test.afterAll(async () => environment?.cleanup());

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const diagnostics = await page
    .evaluate(() => localStorage.getItem('gtop-v2-diagnostics') ?? '[]')
    .catch(() => '[]');
  await testInfo.attach('client-diagnostics.json', {
    body: diagnostics,
    contentType: 'application/json',
  });
  console.error('Client diagnostics:', diagnostics);
});

test('admin keeps the admin shell through practice and review', async ({ page }) => {
  await page.goto(
    `/admin?emulator=1&testEmail=${encodeURIComponent(email)}&testPassword=${encodeURIComponent(password)}`,
  );
  await expect(page.getByRole('heading', { name: /See the system/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Online now')).toBeVisible();
  await page.locator('a.btn', { hasText: 'Take a quiz' }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/practice/);
  const startPractice = page.getByRole('button', { name: /Start practice/i });
  await expect(startPractice).toBeEnabled({ timeout: 40_000 });
  await startPractice.click();
  await expect(page).toHaveURL(/\/admin\/learning\/quiz/, { timeout: 40_000 });
  await expectAdminNavigation(page);
  await page.getByRole('button', { name: /Concave/i }).click();
  await page.getByRole('button', { name: /Finish and review/i }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/quiz-summary/);
  await expectAdminNavigation(page);
});

test('Action Plan loads through the signed-in admin browser client', async ({ page }) => {
  await page.goto(
    `/admin/action-plan?emulator=1&testEmail=${encodeURIComponent(email)}&testPassword=${encodeURIComponent(password)}`,
  );
  await expect(page.getByRole('heading', { name: 'Action plan' })).toBeVisible();
  await expect(
    page.locator('button:visible', { hasText: 'Admin parity verification' }).first(),
  ).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText(/browser access uses the signed-in Firebase client/i)).toHaveCount(0);
});

test('mobile shells expose role-specific navigation without covering the chrome stack', async ({
  page,
}) => {
  await page.goto(
    `/dashboard?emulator=1&testEmail=${encodeURIComponent(learnerEmail)}&testPassword=${encodeURIComponent(password)}`,
  );
  await expect(page.getByRole('heading', { name: /practice/i })).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 940) {
    await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
    return;
  }
  await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const moreDialog = page.getByRole('dialog', { name: 'More options' });
  await expect(moreDialog).toBeVisible();
  await expect(moreDialog.getByRole('link', { name: 'Quiz run', exact: true })).toBeVisible();
  const overlap = await page.evaluate(() => {
    const chrome = document.querySelector('.app-chrome-stack')?.getBoundingClientRect();
    const header = document.querySelector('.mobile-top')?.getBoundingClientRect();
    return chrome && header ? Math.abs(chrome.bottom - header.top) > 1 : true;
  });
  expect(overlap).toBe(false);
});

async function expectAdminNavigation(page: import('@playwright/test').Page): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 940) {
    const trigger = page.getByRole('button', { name: 'Open admin navigation' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation' }).click();
  } else {
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  }
}

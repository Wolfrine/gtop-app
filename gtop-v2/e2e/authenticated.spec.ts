import { expect, test } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const email = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@gtop.test`;
const password = 'GTOP-test-password-2026';
let environment: RulesTestEnvironment;

test.beforeAll(async () => {
  const app = initializeApp({ apiKey: 'demo', projectId: 'gtop-app' }, `e2e-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  environment = await initializeTestEnvironment({
    projectId: 'gtop-app',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName: 'UAT Admin',
      email,
      role: 'admin',
      board: 'CBSE',
      standard: '10',
    });
    await setDoc(doc(firestore, 'syllabus', 'cbse-10-science-light'), {
      board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light', mcqCount: 1,
    });
    await setDoc(doc(firestore, 'questions', 'light-1'), {
      board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light', title: 'Optics',
      question: 'Which lens corrects myopia?', options: ['Concave', 'Convex'], correctIndex: 0,
      solutions: ['A concave lens diverges light.'], flagCount: 0,
    });
    await setDoc(doc(firestore, 'actionPlans', 'e2e-work'), {
      title: 'Admin parity verification', description: 'Visible to signed-in admins', area: 'Testing',
      owner: 'E2E', status: 'in-progress', priority: 'high', labels: ['e2e'], dependencies: [],
      acceptanceCriteria: ['Loads through browser rules'], sourceReferences: [], archived: false,
    });
  });
  await deleteApp(app);
});

test.afterAll(async () => environment?.cleanup());

test('admin keeps the admin shell through practice and review', async ({ page }) => {
  await page.goto(`/admin?emulator=1&testEmail=${encodeURIComponent(email)}&testPassword=${encodeURIComponent(password)}`);
  await expect(page.getByRole('heading', { name: /See the system/i })).toBeVisible();
  await expect(page.getByText('Online now')).toBeVisible();
  await page.locator('a.btn', { hasText: 'Take a quiz' }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/practice/);
  await page.getByRole('button', { name: /Start practice/i }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/quiz/);
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  await page.getByRole('button', { name: /Concave/i }).click();
  await page.getByRole('button', { name: /Finish and review/i }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/quiz-summary/);
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
});

test('Action Plan loads through the signed-in admin browser client', async ({ page }) => {
  await page.goto(`/admin/action-plan?emulator=1&testEmail=${encodeURIComponent(email)}&testPassword=${encodeURIComponent(password)}`);
  await expect(page.getByRole('heading', { name: 'Action plan' })).toBeVisible();
  await expect(page.getByText('Admin parity verification')).toBeVisible();
  await expect(page.getByText(/browser access uses the signed-in Firebase client/i)).toHaveCount(0);
});

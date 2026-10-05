import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import { warmPracticeSummary } from './practice-summary-fixture';
import { writeFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

const tag = `touch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email = `${tag}@gtop.test`;
const password = 'GTOP-touch-isolated-2026';
const subject = `Physics ${tag}`;
let uid: string;
let secondUid: string;
let environment: RulesTestEnvironment;

test.beforeAll(async () => {
  const app = initializeApp({ apiKey: 'demo', projectId: 'gtop-app' }, tag);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid;
  secondUid = (await createUserWithEmailAndPassword(auth, `other-${email}`, password)).user.uid;
  environment = await initializeTestEnvironment({ projectId: 'gtop-app', firestore: { host: '127.0.0.1', port: 8080 } });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', uid), { uid, email, role: 'user', displayName: 'Touch learner', board: 'CBSE', standard: '10' });
    await setDoc(doc(db, 'users', secondUid), { uid: secondUid, email: `other-${email}`, role: 'user', displayName: 'Second learner', board: 'CBSE', standard: '10' });
    for (const chapter of ['Short', 'Long']) {
      await setDoc(doc(db, 'syllabus', `${tag}-${chapter}`), { board: 'CBSE', standard: '10', subject, chapter, mcqCount: 1 });
      await setDoc(doc(db, 'questions', `${tag}-${chapter}`), {
        board: 'CBSE', standard: '10', subject, chapter, questionType: 'mcq', status: 'approved', correctIndex: 0,
        question: chapter === 'Short' ? 'Which quantity measures length?' :
          'A student carefully repeats an experiment to measure the distance travelled by a trolley along a straight track. ' +
          'The track is marked at equal intervals and measurements are recorded at regular times. ' +
          'Before comparing two sets of measurements, the student checks the units used in the experiment and the precision of each reading. ' +
          'Which quantity describes the measured distance, rather than the duration of the experiment, the mass of the trolley, or its temperature?',
        options: chapter === 'Short' ? ['Length', 'Time', 'Mass', 'Temperature'] : [
          'Length, measured in metres, describes the distance between the two marked positions on the track.',
          'Time, measured in seconds, describes the elapsed interval between the two recorded readings.',
          'Mass, measured in kilograms, describes the amount of matter present in the experimental trolley.',
          'Temperature, measured in kelvin, describes the thermal state of the trolley and its surroundings.',
        ],
        solutions: ['Length measures distance.', 'Keep both explanation paragraphs visible.'],
      });
    }
    await setDoc(doc(db, 'syllabus', `${tag}-Flow`), { board: 'CBSE', standard: '10', subject, chapter: 'Flow', mcqCount: 2 });
    for (let i = 0; i < 2; i++) {
      await setDoc(doc(db, 'questions', `${tag}-Flow-${i}`), { board: 'CBSE', standard: '10', subject, chapter: 'Flow',
        questionType: 'mcq', status: 'approved', correctIndex: 0,
        question: i === 0 ? 'Long first question. ' + 'A learner compares distances on a track and records equal time intervals to check the units of every measurement. '.repeat(5) : 'Short second question: which quantity measures length?',
        options: ['Length', 'Time', 'Mass', 'Temperature'], solutions: ['Length measures distance.'],
      });
    }
  });
  await deleteApp(app);
});
test.afterAll(async () => environment?.cleanup());

async function open(page: Page, chapter: string) {
  const params = new URLSearchParams({ emulator: '1', testEmail: email, testPassword: password, subjects: subject, chapters: chapter, count: '1' });
  await page.goto(`/quiz?${params}`);
  await expect(page.locator('.question-card')).toContainText(chapter === 'Short' ? 'Which quantity' : 'A student carefully', { timeout: 25_000 });
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.quiz-container')!;
    const bounds = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
    };
    const next = document.querySelector('.next-button');
    return { viewport: { width: innerWidth, height: innerHeight }, pageScroll: scrollY,
      root: { ...bounds(root), scrollTop: root.scrollTop, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight },
      next: next ? bounds(next) : null,
      options: [...document.querySelectorAll('.option-card')].map(bounds),
    };
  });
}

async function evidence(info: TestInfo, name: string, data: unknown) {
  const path = info.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(data, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
}

async function tapPoint(locator: Locator) {
  return locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return x > 0 && x < innerWidth && y > 70 && y < innerHeight - 10 && hit && element.contains(hit) ? { x, y } : null;
  });
}

async function swipe(page: Page, distance: number) {
  const viewport = page.viewportSize()!;
  // Chromium CDP sends native touch gestures. No scrollIntoView, DOM scroll,
  // programmatic click or forced interaction can manufacture reachability.
  const session = await page.context().newCDPSession(page);
  const startY = distance < 0 ? Math.min(420, viewport.height - 80) : 180;
  const x = viewport.width / 2;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let step = 1; step <= 8; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + distance * step / 8 }] });
    // A realistic gesture spans compositor frames rather than emitting every
    // move at one instant. This is input pacing, not a wait for app readiness.
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await new Promise(resolve => setTimeout(resolve, 80));
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

async function seekAndTap(page: Page, locator: Locator) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const point = await tapPoint(locator);
    if (point) { await page.touchscreen.tap(point.x, point.y); return; }
    const box = await locator.boundingBox();
    await swipe(page, box && box.y < 70 ? 140 : -140);
  }
  throw new Error(`Control cannot be reached by touch gestures: ${JSON.stringify(await geometry(page))}`);
}

for (const chapter of ['Short', 'Long']) {
  test(`${chapter.toLowerCase()} learner question: genuine touch reaches every option and submit; reverse scrolling works`, async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium' || !info.project.use.isMobile, 'Native touch scroll is checked on the compact Chromium phone.');
    await page.addInitScript(() => {
      (window as any).__qaTouchEvents = [];
      document.addEventListener('touchmove', event => {
        (window as any).__qaTouchEvents.push({ trusted: event.isTrusted, y: event.touches[0]?.clientY });
      }, { passive: true });
    });
    await open(page, chapter);
    await evidence(info, 'initial-geometry', await geometry(page));
    await page.screenshot({ path: info.outputPath(`${chapter.toLowerCase()}-initial.png`), fullPage: true, animations: 'disabled' });
    for (let index = 0; index < 4; index++) {
      const choice = page.locator('.option-card').nth(index);
      await seekAndTap(page, choice);
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
    }
    await evidence(info, 'all-options-tapped-geometry', await geometry(page));
    const events = await page.evaluate(() => (window as any).__qaTouchEvents);
    expect(events.some((event: any) => event.trusted)).toBe(true);
    await evidence(info, 'native-touch-events', events);
    await page.screenshot({ path: info.outputPath(`${chapter.toLowerCase()}-all-options-tapped.png`), fullPage: true, animations: 'disabled' });
    const before = await geometry(page);
    await swipe(page, 200);
    await expect.poll(async () => {
      const after = await geometry(page);
      return after.pageScroll < before.pageScroll || after.root.scrollTop < before.root.scrollTop;
    }, { message: 'A downward finger swipe must move back toward the question.' }).toBe(true);
    await seekAndTap(page, page.getByRole('button', { name: 'Submit', exact: true }));
    await expect(page.getByRole('heading', { name: 'See what clicked.' })).toBeVisible();
  });
}

test('keyboard tab order keeps choices and submit visibly reachable on compact screens', async ({ page }, info) => {
  await open(page, 'Long');
  const focusEvents: any[] = [];
  let selected = false;
  let submitted = false;
  for (let i = 0; i < 35 && !submitted; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const r = element.getBoundingClientRect();
      return { text: element.innerText, option: element.classList.contains('option-card'),
        submit: element.innerText.trim() === 'Submit', x: r.x, y: r.y, width: r.width, height: r.height,
        hit: element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    });
    if (focused.option || focused.submit) {
      focusEvents.push(focused);
      expect(focused.hit, JSON.stringify(focused)).toBe(true);
      if (focused.option && !selected) { await page.keyboard.press('Space'); selected = true; }
      if (focused.submit) { await page.keyboard.press('Enter'); submitted = true; }
    }
  }
  await evidence(info, 'keyboard-focus', focusEvents);
  expect(selected).toBe(true);
  expect(submitted).toBe(true);
  await expect(page.getByRole('heading', { name: 'See what clicked.' })).toBeVisible();
});

test('touch Next after a long question brings the next heading into view', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium' || !info.project.use.isMobile, 'Native touch gestures require compact Chromium.');
  await page.addInitScript(() => { Math.random = () => 0.999; });
  const params = new URLSearchParams({ emulator: '1', testEmail: email, testPassword: password, subjects: subject, chapters: 'Flow', count: '2' });
  await page.goto(`/quiz?${params}`);
  await expect(page.locator('.question-card')).toContainText('Long first question', { timeout: 25_000 });
  await seekAndTap(page, page.locator('.option-card').filter({ hasText: 'Length' }));
  await seekAndTap(page, page.getByRole('button', { name: 'Next', exact: true }));
  await expect(page.locator('.question-card')).toContainText('Short second question');
  const heading = await page.locator('.question-card h2').evaluate(element => {
    const r = element.getBoundingClientRect();
    return { y: r.y, bottom: r.bottom, viewport: innerHeight, focused: document.activeElement === element };
  });
  expect(heading.y).toBeGreaterThanOrEqual(70);
  expect(heading.bottom).toBeLessThanOrEqual(heading.viewport);
  expect(heading.focused).toBe(true);
  await page.screenshot({ path: info.outputPath('next-question-visible.png'), fullPage: true, animations: 'disabled' });
});

async function resultCount() {
  let count = 0;
  await environment.withSecurityRulesDisabled(async context => {
    count = (await getDocs(query(collection(context.firestore(), 'QuizResults'), where('userId', '==', uid)))).size;
  });
  return count;
}

test('mounted offline summary invalidates on profile change and retains original attempt', async ({ page, context }) => {
  await open(page, 'Short');
  await warmPracticeSummary(page);
  const beforeCount = await resultCount();
  await context.setOffline(true);
  await page.locator('.option-card').filter({ hasText: 'Length' }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try saving again' })).toBeVisible();
  const retained = await page.evaluate(() => sessionStorage.getItem('gtop.practice-session.v1'));
  try {
    await environment.withSecurityRulesDisabled(async local => {
      await setDoc(doc(local.firestore(), 'users', uid), { board: 'ICSE' }, { merge: true });
    });
    await context.setOffline(false);
    await expect(page.getByRole('alert')).toContainText('Your learning profile changed.');
    await expect(page.getByRole('button', { name: 'Try saving again' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry Entire Quiz', exact: false })).toHaveCount(0);
    expect(await resultCount()).toBe(beforeCount);
    expect(await page.evaluate(() => sessionStorage.getItem('gtop.practice-session.v1'))).toBe(retained);
  } finally {
    await context.setOffline(false);
    await environment.withSecurityRulesDisabled(async local => {
      await setDoc(doc(local.firestore(), 'users', uid), { board: 'CBSE' }, { merge: true });
    });
  }
});

test('cross-tab account switch invalidates the already mounted unsaved summary', async ({ page, context }) => {
  await open(page, 'Short');
  await warmPracticeSummary(page);
  const beforeCount = await resultCount();
  await context.setOffline(true);
  await page.locator('.option-card').filter({ hasText: 'Length' }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try saving again' })).toBeVisible();
  const retained = await page.evaluate(() => sessionStorage.getItem('gtop.practice-session.v1'));
  await context.setOffline(false);
  const other = await context.newPage();
  const params = new URLSearchParams({ emulator: '1', testEmail: `other-${email}`, testPassword: password });
  await other.goto(`/dashboard?${params}`);
  await expect(page.getByRole('alert')).toContainText('Your account changed.');
  await expect(page.getByRole('button', { name: 'Try saving again' })).toHaveCount(0);
  expect(await resultCount()).toBe(beforeCount);
  expect(await page.evaluate(() => sessionStorage.getItem('gtop.practice-session.v1'))).toBe(retained);
  await other.close();
});

test('timed live answer keeps canonical identity and presentation after reload', async ({ page }, info) => {
  const sessionId = `${tag}-live`;
  const beforeCount = await resultCount();
  await environment.withSecurityRulesDisabled(async context => {
    const start = Timestamp.fromMillis(Date.now() - 1000);
    await setDoc(doc(context.firestore(), 'LiveSessions', sessionId), {
      hostId: uid, hostName: 'Local fixture', mode: 'live', status: 'active',
      questionIds: [`${tag}-Short`], scheduledStartAt: start, anchorAt: start, anchorIndex: 0,
      perQuestionSeconds: 90, scope: { board: 'CBSE', standard: '10' },
    });
    await setDoc(doc(context.firestore(), 'LiveSessions', sessionId, 'participants', uid), { uid, displayName: 'Local learner', joinedAt: start });
  });
  const params = new URLSearchParams({ emulator: '1', testEmail: email, testPassword: password, live: '1', sessionId });
  await page.goto(`/quiz?${params}`);
  await expect(page.locator('.question-card')).toContainText('Which quantity', { timeout: 25_000 });
  const before = await page.locator('.answer-copy').allTextContents();
  await page.locator('.option-card').filter({ hasText: 'Length' }).click();
  await expect.poll(async () => {
    let selected: number | undefined;
    await environment.withSecurityRulesDisabled(async context => {
      selected = (await getDoc(doc(context.firestore(), 'LiveSessions', sessionId, 'answers', '0', 'items', uid))).data()?.selectedIndex;
    });
    return selected;
  }).toBe(0);
  await page.reload();
  await expect(page.locator('.question-card')).toContainText('Which quantity');
  expect(await page.locator('.answer-copy').allTextContents()).toEqual(before);
  await expect(page.locator('.option-card.selected')).toContainText('Length');
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('live-restored.png'), fullPage: true, animations: 'disabled' });
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'LiveSessions', sessionId), { status: 'ended' }, { merge: true });
  });
  await expect(page.getByText('Your result is saved in Reports.')).toBeVisible({ timeout: 25_000 });
  const savedLive = async () => {
    let rows: any[] = [];
    await environment.withSecurityRulesDisabled(async context => {
      const snapshot = await getDocs(query(collection(context.firestore(), 'QuizResults'), where('userId', '==', uid), where('sessionId', '==', sessionId)));
      rows = snapshot.docs.map(result => ({ id: result.id, ...result.data() }));
    });
    return rows;
  };
  const saved = await savedLive();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ sessionId, quizType: 'live', correctAnswers: 1 });
  expect(saved[0].questions[0]).toMatchObject({ selectedIndex: 0, correctIndex: 0, isCorrect: true });
  expect(await resultCount()).toBe(beforeCount + 1);
  await page.goto(`/quiz?${params}`);
  await expect(page.getByRole('heading', { name: 'See what clicked.' })).toBeVisible();
  await expect(page.getByText('Your result is saved in Reports.')).toBeVisible();
  await expect(page.locator('.chip').filter({ hasText: 'Correct: 1' })).toBeVisible();
  expect(await savedLive()).toEqual(saved);
  expect(await resultCount()).toBe(beforeCount + 1);
  await page.screenshot({ path: info.outputPath('live-ended-reentry.png'), fullPage: true, animations: 'disabled' });
  const summaryLayout = await page.evaluate(() => ({
    viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll('.summary-container, .score-card, .score-grid, .score-card .stats, .score-card .actions button')].map(element => {
      const r = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { tag: element.tagName, text: element.textContent?.trim().slice(0, 80), left: r.left, right: r.right, width: r.width,
        minWidth: style.minWidth, gridTemplateColumns: style.gridTemplateColumns, color: style.color, background: style.backgroundColor };
    }),
  }));
  await evidence(info, 'live-summary-layout', summaryLayout);
  expect(summaryLayout.scrollWidth).toBeLessThanOrEqual(summaryLayout.viewport);
  for (const element of summaryLayout.elements) {
    expect(element.right, JSON.stringify(element)).toBeLessThanOrEqual(summaryLayout.viewport);
    expect(element.left, JSON.stringify(element)).toBeGreaterThanOrEqual(0);
  }
});

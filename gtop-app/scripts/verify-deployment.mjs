import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const [origin, expectedCommit] = process.argv.slice(2);
assert(origin && expectedCommit, 'Usage: node scripts/verify-deployment.mjs ORIGIN COMMIT');
const base = new URL(origin);
assert.equal(base.protocol, 'https:');

async function get(path) {
  const response = await fetch(new URL(path, base), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response;
}

let release;
for (let attempt = 0; attempt < 12; attempt++) {
  release = await (await get('/version.json')).json();
  if (release.commit === expectedCommit) break;
  await new Promise(resolve => setTimeout(resolve, 5000));
}
assert.equal(release.commit, expectedCommit, 'Hosted release does not match the validated commit');
const html = await (await get('/')).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
assert(scripts.length, 'No application entry scripts found');
for (const path of scripts.filter(path => new URL(path, base).origin === base.origin)) {
  const response = await get(path);
  assert(/javascript/.test(response.headers.get('content-type') ?? ''), `${path} is not JavaScript`);
  assert(!(await response.text()).trimStart().startsWith('<'), `${path} returned fallback HTML`);
}

await mkdir('test-results/deployed-site', { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /A little practice/i }).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflows viewport');
    await page.screenshot({ path: `test-results/deployed-site/landing-${viewport.width}.png`, fullPage: true });
    await page.goto(new URL('/admin/question-paper-generator', base).href);
    await page.getByRole('heading', { name: /A little practice/i }).waitFor({ timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.get('returnUrl'), '/admin/question-paper-generator', 'Admin sign-in loses the requested paper page');
    assert.deepEqual(errors, [], 'Hosted pages raised uncaught errors');
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Verified deployed release ${release.commit}: entry assets, desktop/mobile landing and admin sign-in return path.`);

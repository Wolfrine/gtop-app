import { expect, test } from '@playwright/test';

const invite='/practice?board=CBSE&standard=12&subjects=Chemistry&chapters=Solutions&count=5';
test.beforeEach(async({page})=>{
  // Public preview tests use no accounts, writes, or production network traffic.
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4300'||['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)?route.continue():route.abort();
  });
});
test('public preview exposes reviewed scope and sign-in without exposing questions',async({page})=>{
  await page.goto(invite);
  await expect(page.getByRole('heading',{name:'Revisit Solutions.'})).toBeVisible();
  await expect(page.getByText('CBSE · Class 12',{exact:true})).toBeVisible();
  await expect(page.getByText('Five questions. Your own pace.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Practice is being checked'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sign in to practise',exact:true})).toBeVisible();
  await expect(page.locator('app-quiz-page')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('ambiguous repeated scope fails closed instead of falling back to a chapter quiz',async({page})=>{
  await page.goto(invite+'&subjects=Physics');
  await expect(page.getByRole('heading',{name:'This link needs a little help.'})).toBeVisible();
  await expect(page.locator('app-quiz-page')).toHaveCount(0);
});
test('untrusted labels render as escaped text',async({page})=>{
  const chapter='<img src=x onerror="window.injected=true">';
  await page.goto(invite.replace('Solutions',encodeURIComponent(chapter)));
  await expect(page.getByRole('heading',{level:1})).toHaveText(`Revisit ${chapter}.`);
  expect(await page.locator('h1 img').count()).toBe(0);
  expect(await page.evaluate(()=>(window as any).injected)).toBeUndefined();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('content failure displays one clear state',async({page})=>{
  await page.goto(invite+'&unavailable=1');
  await expect(page.getByRole('alert')).toContainText('could not be opened');
  await expect(page.getByRole('heading',{name:'Practice is being checked'})).toHaveCount(0);
});

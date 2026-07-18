import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('landing page communicates the new practice loop', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Practice with focus/i })).toBeVisible();
  await expect(page.getByText('UAT — LIVE PRODUCTION DATA')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('public landing has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('an unauthenticated deep link returns to sign-in with its target intact', async ({ page }) => {
  await page.goto('/admin/action-plan');
  await expect(page).toHaveURL(/returnUrl=%2Fadmin%2Faction-plan/);
  await expect(page.getByRole('heading', { name: /Practice with focus/i })).toBeVisible();
});

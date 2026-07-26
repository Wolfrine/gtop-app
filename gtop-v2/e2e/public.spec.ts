import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('landing page communicates the new practice loop', async ({ page }) => {
  await page.goto('/?emulator=1');
  await expect(page.getByRole('heading', { name: /Practice with focus/i })).toBeVisible();
  await expect(page.getByText('UAT — LIVE PRODUCTION DATA')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('public landing has no serious accessibility violations', async ({ page }) => {
  await page.goto('/?emulator=1');
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
});

test('public mobile layout has safe tap targets and no clipped fixed controls', async ({
  page,
}) => {
  await page.goto('/?emulator=1');
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 940) test.skip();
  const unsafe = await page.locator('button,a').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width < 44 || target.height < 44),
  );
  expect(unsafe).toEqual([]);
  const diagnostics = await page.getByRole('button', { name: 'Diagnostics' }).boundingBox();
  expect(diagnostics).not.toBeNull();
  expect(diagnostics!.x).toBeGreaterThanOrEqual(0);
  expect(diagnostics!.y).toBeGreaterThanOrEqual(0);
  expect(diagnostics!.x + diagnostics!.width).toBeLessThanOrEqual(viewport.width);
  expect(diagnostics!.y + diagnostics!.height).toBeLessThanOrEqual(viewport.height);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
});

test('an unauthenticated deep link returns to sign-in with its target intact', async ({ page }) => {
  await page.goto('/admin/action-plan?emulator=1');
  await expect(page).toHaveURL(/returnUrl=%2Fadmin%2Faction-plan/);
  await expect(page.getByRole('heading', { name: /Practice with focus/i })).toBeVisible();
});

test('publishes a branded installable application manifest', async ({ page, request }) => {
  await page.goto('/?emulator=1');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /icons\/icon-48-48\.png/);
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
});

test('exposes copyable client diagnostics before sign-in', async ({ page }) => {
  await page.goto('/?emulator=1');
  await page.getByRole('button', { name: 'Diagnostics' }).click();
  await expect(page.getByRole('dialog', { name: 'Client diagnostics' })).toBeVisible();
  await expect(page.getByText('Client diagnostics initialized.')).toBeVisible();
  await page.getByRole('button', { name: 'Run device check' }).click();
  await expect(page.getByText('Device check added to the report.')).toBeVisible();
  await expect(page.getByText('Device self-check completed.')).toBeVisible();
});

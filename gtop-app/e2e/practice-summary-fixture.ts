import type { Page } from '@playwright/test';

// Mounted-summary regressions require its code to be loaded before going offline.
// The invitation suite separately checks uncached navigation and retained-answer recovery.
export async function warmPracticeSummary(page: Page) {
  await page.evaluate(async () => {
    const entry = [...document.querySelectorAll<HTMLScriptElement>('script[src]')]
      .find(script => /\/main(?:-[\w]+)?\.js/.test(script.src))?.src;
    if (!entry) throw Error('Main module not found');
    const source = await (await fetch(entry)).text();
    const module = source.match(/path:\s*["']quiz-summary["'][\s\S]{0,300}?import\(["']([^"'\s]+)["']\)/)?.[1];
    if (!module) throw Error('Summary route module not found');
    await import(new URL(module, entry).href);
  });
}

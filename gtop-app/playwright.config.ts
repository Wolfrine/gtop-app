import { defineConfig, devices } from '@playwright/test';

const chromiumLaunch = process.env['GTOP_CHROMIUM_PATH'] ? {launchOptions:{executablePath:process.env['GTOP_CHROMIUM_PATH']}} : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: process.env['CI'] ? 2 : 3,
  retries: process.env['CI'] ? 2 : 0,
  // A persistent failure already blocks deployment. Stop there to expose its
  // trace promptly; successful runs still execute the complete device matrix.
  maxFailures: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4300', trace: 'on-first-retry', screenshot:'only-on-failure' },
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} start -- --configuration development --host 127.0.0.1 --port 4300`,
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], ...chromiumLaunch } },
    {
      name: 'compact-phone-chromium',
      use: {
        ...devices['Desktop Chrome'], ...chromiumLaunch,
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'android-phone-chromium',
      use: {
        ...devices['Desktop Chrome'], ...chromiumLaunch,
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    {
      name: 'landscape-phone-chromium',
      use: {
        ...devices['Desktop Chrome'], ...chromiumLaunch,
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-portrait-chromium',
      use: { ...devices['Desktop Chrome'], ...chromiumLaunch, viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'tablet-landscape-webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    {
      name: 'wide-desktop-chromium',
      use: { ...devices['Desktop Chrome'], ...chromiumLaunch, viewport: { width: 1440, height: 1000 } },
    },
  ],
});

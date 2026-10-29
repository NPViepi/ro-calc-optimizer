import { defineConfig } from '@playwright/test';

const baseURL = process.env['UI_TEST_URL'] || 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.001 } },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    // Every spec reads the Portuguese interface, so the suite opens as a reader who has
    // already answered the first-run language dialog. Without this the dialog's backdrop
    // and focus trap sit over the app in all of them.
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'ro-locale', value: 'pt-BR' }] }] },
    channel: process.env['PLAYWRIGHT_CHANNEL'] || (process.platform === 'win32' ? 'chrome' : undefined),
    viewport: { width: 1920, height: 918 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env['UI_TEST_URL'] ? undefined : {
    command: 'node tools/serve-web.mjs --host 127.0.0.1 --port 4200',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});

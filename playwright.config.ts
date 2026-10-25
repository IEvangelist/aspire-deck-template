import { defineConfig } from '@playwright/test';
import { starterTag } from './tests/starter';

const external = process.env.DECK_URL;

// `npm test` runs every test that works for any deck. Tests tagged with `starter` (tests/starter.ts) assert this template's
// own starter slides and run in `npm run test:starter` instead (playwright.starter.config.ts).
export default defineConfig({
  testDir: './tests',
  grepInvert: new RegExp(starterTag),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: external ?? 'http://127.0.0.1:4387/',
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  webServer: external ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4387 --strictPort',
    url: 'http://127.0.0.1:4387/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

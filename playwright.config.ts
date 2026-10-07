import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** `npm run screenshots` runs only the @screenshots tests; normal runs skip them. */
const SCREENSHOTS = !!process.env.SCREENSHOTS;

/** E2E runs against the production build (`vite preview`), so the CSP is active. */
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  grep: SCREENSHOTS ? /@screenshots/ : undefined,
  grepInvert: SCREENSHOTS ? undefined : /@screenshots/,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});

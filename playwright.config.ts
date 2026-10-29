import { defineConfig, devices } from '@playwright/test';

// PLACEHOLDER: no end-to-end test until the front arrives (L2). That ticket adds the first
// tests to e2e/ and a webServer entry that starts the front with the fake Sources, Claude
// launcher and notification channel.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env.CI !== undefined,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env.CI !== undefined,
  use: { baseURL: BASE_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'react-router dev --port 5173 --strictPort',
    url: `${BASE_URL}/design`,
    reuseExistingServer: process.env.CI === undefined,
  },
});

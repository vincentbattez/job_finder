import { defineConfig, devices } from '@playwright/test';

// Each git worktree starts its own dev server: E2E_PORT keeps parallel runs apart
const PORT = process.env.E2E_PORT ?? '5173';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env.CI !== undefined,
  use: { baseURL: BASE_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `react-router dev --port ${PORT} --strictPort`,
    url: `${BASE_URL}/design`,
    reuseExistingServer: process.env.CI === undefined,
  },
});

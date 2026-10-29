import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Each git worktree starts its own dev server: E2E_PORT keeps parallel runs apart
const PORT = process.env.E2E_PORT ?? '5173';
const BASE_URL = `http://localhost:${PORT}`;
// The front runs on a temporary data folder, never data/: test/seed-front.ts fills it through the
// actions with the fakes before the dev server starts
const DATA_DIRECTORY = path.join(tmpdir(), `job-finder-e2e-${PORT}`);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env.CI !== undefined,
  use: { baseURL: BASE_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node test/seed-front.ts && react-router dev --port ${PORT} --strictPort`,
    // Even when the shell exports them: the front never sends a real notification in the tests
    env: { JF_DATA_DIRECTORY: DATA_DIRECTORY, HOME_ASSISTANT_URL: '', HOME_ASSISTANT_TOKEN: '' },
    url: `${BASE_URL}/design`,
    // A server already running on the port may read data/: always start the one seeded above
    reuseExistingServer: false,
  },
});

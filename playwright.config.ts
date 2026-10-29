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
  webServer: [
    {
      // The e2e mode serves the actions with the fakes of the external boundaries (vite.config.ts)
      command: `node test/seed-front.ts && react-router dev --mode e2e --port ${PORT} --strictPort`,
      env: { JF_DATA_DIRECTORY: DATA_DIRECTORY },
      url: `${BASE_URL}/design`,
      // A server already running on the port may read data/: always start the one seeded above
      reuseExistingServer: false,
    },
    {
      // The worker, in its own process like the lpm service: it runs the jobs the front queues,
      // with the fake Claude. Started once the folder is seeded and the front is up.
      command: 'node test/e2e-worker.ts',
      env: { JF_DATA_DIRECTORY: DATA_DIRECTORY },
      wait: { stdout: /Worker prêt/ },
    },
  ],
});

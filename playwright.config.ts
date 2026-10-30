import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { FAKE_HOME_ASSISTANT_TOKEN } from './test/fake-home-assistant.ts';

// Each git worktree starts its own dev server: without E2E_PORT, a port derived from the checkout
// path keeps parallel worktrees apart, and stays the same in every process that loads this config
const PORT =
  process.env.E2E_PORT ??
  String(
    20_000 +
      (createHash('sha256')
        .update(import.meta.dirname)
        .digest()
        .readUInt16BE(0) %
        10_000),
  );
const BASE_URL = `http://localhost:${PORT}`;
// The front runs on a temporary data folder, never data/: test/seed-front.ts fills it through the
// actions with the fakes before the dev server starts
const DATA_DIRECTORY = path.join(tmpdir(), `job-finder-e2e-${PORT}`);
// Whatever the shell exports, the seed, the front and the worker notify the fake Home Assistant,
// never a real phone; its port follows E2E_PORT so parallel runs stay apart
const HOME_ASSISTANT_PORT = String(Number(PORT) + 10_000);
const HOME_ASSISTANT_URL = `http://localhost:${HOME_ASSISTANT_PORT}`;
const ENV = {
  JF_DATA_DIRECTORY: DATA_DIRECTORY,
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN: FAKE_HOME_ASSISTANT_TOKEN,
};

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env.CI !== undefined,
  // Even the tests of one file run side by side: one that reads what another left fails here first
  fullyParallel: true,
  use: { baseURL: BASE_URL },
  // How a test reaches the fake Home Assistant, to read the notifications it received, and the data
  // folder, to put back the Profil it changes (e2e/profil.test.ts)
  metadata: { homeAssistantUrl: HOME_ASSISTANT_URL, dataDirectory: DATA_DIRECTORY },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Started first: the seed already notifies it
      command: `node test/fake-home-assistant-server.ts ${HOME_ASSISTANT_PORT}`,
      wait: { stdout: /Faux Home Assistant prêt/ },
    },
    {
      // The e2e mode serves the actions with the fakes of the external boundaries (vite.config.ts)
      command: `node test/seed-front.ts && react-router dev --mode e2e --port ${PORT} --strictPort`,
      env: ENV,
      url: `${BASE_URL}/design`,
      // A server already running on the port may read data/: always start the one seeded above
      reuseExistingServer: false,
    },
    {
      // The worker, in its own process like the lpm service: it runs the jobs the front queues,
      // with the fake Claude. Started once the folder is seeded and the front is up.
      command: 'node test/e2e-worker.ts',
      env: ENV,
      wait: { stdout: /Worker prêt/ },
    },
  ],
});

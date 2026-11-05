import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { FAKE_HOME_ASSISTANT_TOKEN } from './test/fake-home-assistant.ts';
import { stopLeftoverWebServers } from './test/stop-leftover-web-servers.ts';

// Each git worktree starts its own server: without E2E_PORT, a port derived from the checkout
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
// actions with the fakes before the server starts
const DATA_DIRECTORY = path.join(tmpdir(), `job-finder-e2e-${PORT}`);
// The seed saves Notification Channels through the fake Home Assistant, never a real phone; its port
// follows E2E_PORT so parallel runs stay apart
const HOME_ASSISTANT_PORT = String(Number(PORT) + 10_000);
const FAKE_HOME_ASSISTANT_URL = `http://localhost:${HOME_ASSISTANT_PORT}`;
// Only the runner, before it starts the web servers: the test workers load this config too
if (process.env.TEST_WORKER_INDEX === undefined) {
  stopLeftoverWebServers({ portList: [PORT, HOME_ASSISTANT_PORT], checkoutDirectory: import.meta.dirname });
}
// Beside the data folder, for e2e/detection.test.ts to hold a Detection in progress (test/fake-slow-source.ts)
const DETECTION_HOLD_PATH = `${DATA_DIRECTORY}-hold-detection`;
const ENV = {
  JF_DATA_DIRECTORY: DATA_DIRECTORY,
  E2E_DETECTION_HOLD_PATH: DETECTION_HOLD_PATH,
  FAKE_HOME_ASSISTANT_URL,
};

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env.CI !== undefined,
  // Even the tests of one file run side by side: one that reads what another left fails here first
  fullyParallel: true,
  // Playwright's default of half the cores runs them one at a time on the 2 vCPUs of the GitHub runner:
  // two side by side doubled a test's time on a slow runner, over its budget
  // Each test with its duration, in CI as well; the second fails a run over the time budgets
  reporter: [['list'], ['./test/playwright-time-budget-reporter.ts']],
  use: {
    baseURL: BASE_URL,
  },
  // How a test reaches the fake Home Assistant, to read the notifications it received or save its
  // token in a Notification Channel (e2e/notifications.test.ts), and the data
  // folder, to put back the Profile it changes (e2e/profile.test.ts)
  metadata: {
    homeAssistantUrl: FAKE_HOME_ASSISTANT_URL,
    homeAssistantToken: FAKE_HOME_ASSISTANT_TOKEN,
    dataDirectory: DATA_DIRECTORY,
    detectionHoldPath: DETECTION_HOLD_PATH,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Started first: the seed already notifies it
      command: `node test/fake-home-assistant-server.ts ${HOME_ASSISTANT_PORT}`,
      wait: { stdout: /Fake Home Assistant ready/ },
    },
    {
      // The e2e mode builds the actions with the fakes of the external boundaries (vite.config.ts). Built
      // once rather than on the dev server (test/e2e-server.ts)
      command: `node test/seed-front.ts && react-router build --mode e2e && node test/e2e-server.ts ${PORT}`,
      env: ENV,
      url: `${BASE_URL}/`,
      // A server already running on the port may read data/: always start the one seeded above
      reuseExistingServer: false,
    },
    {
      // The worker, in its own process like the lpm service: it runs the jobs the front queues,
      // with the fake Claude. Started once the folder is seeded and the front is up.
      command: 'node test/e2e-worker.ts',
      env: ENV,
      wait: { stdout: /Worker ready/ },
    },
  ],
});

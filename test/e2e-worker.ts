import { setTimeout } from 'node:timers/promises';

import { ACTIONS } from './e2e-actions.server.ts';

// How often the worker looks for queued jobs: shorter than the real one, so the tests wait less
const POLL_INTERVAL_MS = 100;

// The worker of the e2e tests, the second web server of playwright.config.ts: in its own process,
// like the lpm service, it runs the jobs the front queues, with the fake Claude (ADR-0003)
process.stdout.write('Worker ready: it runs the queued jobs, one at a time.\n');
// Has no port to free at the next run: stops itself once the runner that started it is gone
while (process.ppid !== 1) {
  // Its fake sessions are short: a beat at each round tells the front it runs
  await ACTIONS.beatWorker();
  await ACTIONS.runQueuedJobs();
  await setTimeout(POLL_INTERVAL_MS);
}

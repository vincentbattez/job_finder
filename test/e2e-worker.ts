import { setTimeout } from 'node:timers/promises';

import { ACTIONS } from './e2e-actions.server.ts';

// How often the worker looks for queued jobs: shorter than the real one, so the tests wait less
const POLL_INTERVAL_MS = 300;

// The worker of the e2e tests, the second web server of playwright.config.ts: in its own process,
// like the lpm service, it runs the jobs the front queues, with the fake Claude (ADR-0003)
process.stdout.write('Worker prêt : il lance les jobs en file, un à la fois.\n');
for (;;) {
  await ACTIONS.runQueuedJobs();
  await setTimeout(POLL_INTERVAL_MS);
}

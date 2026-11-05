import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { test } from '@playwright/test';
import { z } from 'zod/v4';

// How long a raw write waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;

// The worker takes the job, then its fake session runs (test/e2e-actions.server.ts)
export const READY_TIMEOUT_MS = 15_000;

// The data folder of the run, which playwright.config.ts names
export function findDataDirectory(): string {
  return z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata).dataDirectory;
}

export function openDatabase(): DatabaseSync {
  return new DatabaseSync(path.join(findDataDirectory(), 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
}

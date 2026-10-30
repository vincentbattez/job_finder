import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { TestProject } from 'vitest/node';

import { migrateDeploy } from './prisma-cli.ts';

declare module 'vitest' {
  interface ProvidedContext {
    migratedDatabasePath: string;
  }
}

// Migrated once per run: a data folder copied from it opens without the Prisma CLI (ADR-0004)
export function setup({ provide }: TestProject): void {
  const directory = mkdtempSync(path.join(tmpdir(), 'job-finder-migrated-'));
  const databasePath = path.join(directory, 'job_finder.sqlite');
  migrateDeploy(databasePath);
  provide('migratedDatabasePath', databasePath);
}

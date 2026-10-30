import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { TestProject } from 'vitest/node';

import { migrateDeploy } from './prisma-cli.ts';

declare module 'vitest' {
  interface ProvidedContext {
    migratedDatabasePath: string;
    leaDatabasePath: string;
  }
}

// Migrated once per run: a data folder copied from it opens without the Prisma CLI (ADR-0004). A
// copy also gets Léa and her Watch, through the actions, in a process of its own: the actions
// do not open where Vitest runs its global setup.
export function setup({ provide }: TestProject): void {
  const directory = mkdtempSync(path.join(tmpdir(), 'job-finder-migrated-'));
  const databasePath = path.join(directory, 'job_finder.sqlite');
  migrateDeploy(databasePath);
  provide('migratedDatabasePath', databasePath);
  const leaDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-lea-'));
  copyFileSync(databasePath, path.join(leaDirectory, 'job_finder.sqlite'));
  execFileSync(process.execPath, [path.join(import.meta.dirname, 'create-lea-database.ts'), leaDirectory], {
    stdio: 'pipe',
  });
  provide('leaDatabasePath', path.join(leaDirectory, 'job_finder.sqlite'));
}

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { TestProject } from 'vitest/node';

import { migrateDeploy } from './prisma-cli.ts';

declare module 'vitest' {
  interface ProvidedContext {
    migratedDatabasePath: string;
    leaDatabasePath: string;
    detectedDataDirectory: string;
  }
}

// Runs the given script of test/ in a process of its own, on the data folder: the actions do not
// open where Vitest runs its global setup
function runOnDataDirectory(scriptName: string, dataDirectory: string): void {
  execFileSync(process.execPath, [path.join(import.meta.dirname, scriptName), dataDirectory], { stdio: 'pipe' });
}

// One root per run for every temporary folder the tests create, removed when the run ends, failed
// or not (#109): about 500 MB per run that piled up in the system's temporary folder. Set as
// TMPDIR before the workers are forked and before anything below spawns, each mkdtemp of the tests
// and of the processes they spawn (the Prisma CLI, the scripts of test/) lands under it, with its
// own prefix. Never a fixed path: concurrent runs keep their own root.
function createRunRoot(): () => void {
  const root = mkdtempSync(path.join(tmpdir(), 'job-finder-run-'));
  process.env.TMPDIR = root;
  return () => {
    rmSync(root, { recursive: true, force: true });
  };
}

// Migrated once per run: a data folder copied from it opens without the Prisma CLI (ADR-0004). A
// copy also gets Léa and her Watch, through the actions. A copy of that one gets the first
// Detection on the recorded responses, which every test on the Postings would otherwise run
// again (over 97 % of such a test): detectPostings copies its folder instead.
export function setup({ provide }: TestProject): () => void {
  const teardown = createRunRoot();
  const directory = mkdtempSync(path.join(tmpdir(), 'job-finder-migrated-'));
  const databasePath = path.join(directory, 'job_finder.sqlite');
  migrateDeploy(databasePath);
  provide('migratedDatabasePath', databasePath);
  const leaDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-lea-'));
  copyFileSync(databasePath, path.join(leaDirectory, 'job_finder.sqlite'));
  runOnDataDirectory('create-lea-database.ts', leaDirectory);
  provide('leaDatabasePath', path.join(leaDirectory, 'job_finder.sqlite'));
  const detectedDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-detected-'));
  copyFileSync(path.join(leaDirectory, 'job_finder.sqlite'), path.join(detectedDirectory, 'job_finder.sqlite'));
  runOnDataDirectory('create-detected-folder.ts', detectedDirectory);
  provide('detectedDataDirectory', detectedDirectory);
  return teardown;
}

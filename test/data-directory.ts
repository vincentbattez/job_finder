import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { inject } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

const LOCK_HELD_MS = 300;

// Where the folder of each of Léa's Postings lives, in a data folder
export const LEA_POSTINGS_PATH = 'candidates/lea/postings';

function copyDatabase(databasePath: string): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(databasePath, path.join(dataDirectory, 'job_finder.sqlite'));
  return dataDirectory;
}

// A temporary data folder, never data/, whose database is already migrated and has no Candidate yet
// (test/global-setup.ts)
export function createMigratedDataDirectory(): string {
  return copyDatabase(inject('migratedDatabasePath'));
}

// A temporary data folder, never data/, where Léa was created as from the front, with her Watch
// (test/lea.ts). She has no Notification Channel yet.
export function createDataDirectory(): string {
  return copyDatabase(inject('leaDatabasePath'));
}

// A copy of the data folder of that first Detection, for a test that opens it without the actions
export function copyDetectedDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  cpSync(inject('detectedDataDirectory'), dataDirectory, { recursive: true });
  return dataDirectory;
}

// Another process holding the write lock of the database for a moment, as the worker or a Detection
// does all the time. Resolved once it holds it.
export async function holdDatabaseLock(dataDirectory: string): Promise<void> {
  const holder = spawn(process.execPath, [
    '--eval',
    `const { DatabaseSync } = require('node:sqlite');
     const database = new DatabaseSync(process.argv[1]);
     database.exec('BEGIN IMMEDIATE');
     console.log('held');
     setTimeout(() => database.exec('COMMIT'), ${String(LOCK_HELD_MS)});`,
    path.join(dataDirectory, 'job_finder.sqlite'),
  ]);
  await once(holder.stdout, 'data');
}

// The Postings already online, imported by a first Detection on the responses recorded on 2026-10-29,
// with the fakes of every external boundary; Léa's Notification Channel is the fake one. That
// Detection ran once per run (test/global-setup.ts): the data folder is a copy of its result, Job
// Descriptions on disk included, so its timestamps date from the start of the run.
export async function detectPostings(aiSession = createFakeAiSession()) {
  const dataDirectory = copyDetectedDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const actions = await createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  return { actions, dataDirectory, notificationChannel };
}

import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { inject } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeCanalNotification } from './fake-canal-notification.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Where the folder of each of Léa's Offres lives, in a data folder
export const LEA_OFFRES_PATH = 'candidates/lea/offres';

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

// A temporary data folder, never data/, where Léa was created as from the front, with her Veille
// (test/lea.ts). She has no Canal de notification yet.
export function createDataDirectory(): string {
  return copyDatabase(inject('leaDatabasePath'));
}

// The Offres already online, imported by a first Détection on the responses recorded on 2026-10-29,
// with the fakes of every external boundary; Léa's Canal de notification is the fake one
export async function detectOffres(aiSession = createFakeAiSession()) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeCanalNotification();
  const actions = await createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    canalNotificationList: notificationChannel.canalNotificationList,
  });
  await notificationChannel.saveFor(actions);
  await actions.detect();
  return { actions, dataDirectory, notificationChannel };
}

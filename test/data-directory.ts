import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// Where the folder of each of Léa's Offres lives, in a data folder
export const LEA_OFFRES_PATH = 'candidats/lea/offres';

// A temporary data folder, never data/, with the example config: Léa follows the attaché de justice
// Offres, her Zone the courts of appeal of Douai and Amiens
export function createDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return dataDirectory;
}

// The Offres already online, imported by a first Détection on the responses recorded on 2026-10-29,
// with the fakes of every external boundary
export async function detectOffres(aiSession = createFakeAiSession()) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const actions = await createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannel,
  });
  await actions.detect();
  return { actions, dataDirectory, notificationChannel };
}

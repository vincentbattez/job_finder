import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// Léa's phone, as config.example.json names it
const LEA_TARGET = 'notify.mobile_app_iphone_de_lea';

// The two Béthune Offres, both in the Zone, and an attaché de justice Offre outside it, from the
// responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';
const OUT_OF_ZONE_REFERENCE = '2026-2215099';

const RECHERCHE = { fileByName: { 'recherche.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

function createDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return dataDirectory;
}

// A first Détection on the feed as it was before the given Offres were published, then the actions
// for the next one, on the feed as recorded
async function detectBefore(referenceList: string[]) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout(referenceList) } }).fetch;
  const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch, notificationChannel });
  await earlierActions.detect();
  const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch, notificationChannel });
  return { actions, notificationChannel };
}

describe('the notification of a new Offre in the Zone', () => {
  it('tells the Candidat its title, its juridiction and its Date limite, for each new Offre in the Zone only', async () => {
    const { actions, notificationChannel } = await detectBefore([REFERENCE, OTHER_REFERENCE, OUT_OF_ZONE_REFERENCE]);

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([
      {
        target: LEA_TARGET,
        title: 'Nouvelle Offre dans la Zone',
        message:
          'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE\nTribunal Judiciaire de Béthune\nDate limite : 20/11/2026',
      },
      {
        target: LEA_TARGET,
        title: 'Nouvelle Offre dans la Zone',
        message:
          "Attaché de justice affecté auprès des magistrats du siège - Service de l'instruction - TJ BETHUNE\nTribunal Judiciaire de Béthune\nDate limite : 20/11/2026",
      },
    ]);
  });

  it('sends nothing on the first launch, which imports the Offres already online', async () => {
    const notificationChannel = createFakeNotificationChannel();
    const actions = await createActions({
      dataDirectory: createDataDirectory(),
      fetch: createRecordedFetch().fetch,
      notificationChannel,
    });

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([]);
  });

  it('sends nothing when the Détection finds nothing new', async () => {
    const { actions, notificationChannel } = await detectBefore([]);

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([]);
  });
});

// The Offres already online, imported by a first Détection without any notification
async function detectOffres(aiSession: ReturnType<typeof createFakeAiSession>) {
  const notificationChannel = createFakeNotificationChannel();
  const dataDirectory = createDataDirectory();
  const actions = await createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannel,
  });
  await actions.detect();
  return { actions, notificationChannel };
}

describe('the notification of a Recherche ready', () => {
  it('tells the Candidat which Offre has its Recherche ready, once the worker has produced it', async () => {
    const { actions, notificationChannel } = await detectOffres(createFakeAiSession(RECHERCHE));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    await actions.runQueuedJobs();

    expect(notificationChannel.sentList).toEqual([
      {
        target: LEA_TARGET,
        title: 'Recherche prête',
        message:
          'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE\nTribunal Judiciaire de Béthune',
      },
    ]);
  });

  it('sends nothing for a Recherche that failed', async () => {
    const { actions, notificationChannel } = await detectOffres(createFakeAiSession({ isSuccess: false }, {}));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: OTHER_REFERENCE });

    await actions.runQueuedJobs();

    expect(notificationChannel.sentList).toEqual([]);
  });
});

describe('a notification that cannot be sent', () => {
  const ERROR_MESSAGE = 'Home Assistant injoignable.';

  it('makes the Détection fail visibly', async () => {
    const dataDirectory = createDataDirectory();
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REFERENCE]) } }).fetch;
    const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch });
    await earlierActions.detect();
    const notificationChannel = createFakeNotificationChannel({ errorMessage: ERROR_MESSAGE });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch, notificationChannel });

    await expect(actions.detect()).rejects.toThrow(ERROR_MESSAGE);
  });

  it("stops the worker's turn visibly, the Recherche staying ready", async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession(RECHERCHE);
    const earlierActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await earlierActions.detect();
    const notificationChannel = createFakeNotificationChannel({ errorMessage: ERROR_MESSAGE });
    const actions = await createActions({ dataDirectory, aiSession, notificationChannel });
    const { id } = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    await expect(actions.runQueuedJobs()).rejects.toThrow(ERROR_MESSAGE);

    expect(await actions.followJob({ jobId: id })).toMatchObject({ state: 'done', version: { state: 'ready' } });
  });
});

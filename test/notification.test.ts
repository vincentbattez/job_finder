import { afterEach, describe, expect, it, vi } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, detectOffres } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel, LEA_TARGET } from './fake-notification-channel.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// The two Béthune Offres, both in the Zone, and an attaché de justice Offre outside it, from the
// responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';
const OUT_OF_ZONE_REFERENCE = '2026-2215099';

const RECHERCHE = { fileByName: { 'recherche.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

afterEach(() => {
  vi.restoreAllMocks();
});

// A first Detection on the feed as it was before the given Offres were published, then the actions
// for the next one, on the feed as recorded
async function detectBefore(referenceList: string[]) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout(referenceList) } }).fetch;
  const earlierActions = await createActions({
    dataDirectory,
    fetch: earlierFetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  await notificationChannel.saveFor(earlierActions);
  await earlierActions.detect();
  const actions = await createActions({
    dataDirectory,
    fetch: createRecordedFetch().fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  return { actions, notificationChannel };
}

describe('the notification of a new Offre in the Zone', () => {
  it('tells the Candidate its title, its jurisdiction and its Date limite, for each new Offre in the Zone only', async () => {
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
      notificationChannelList: notificationChannel.notificationChannelList,
    });

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([]);
  });

  it('sends nothing when the Detection finds nothing new', async () => {
    const { actions, notificationChannel } = await detectBefore([]);

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([]);
  });
});

describe('the notification of a Recherche ready', () => {
  it('tells the Candidate which Offre has its Recherche ready, once the worker has produced it', async () => {
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

  it('reports each notification not sent with what the Detection found, once every new Offre is saved and its Recherche queued', async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession(RECHERCHE, RECHERCHE);
    const earlierFetch = createRecordedFetch({
      [DSJ_FEED_URL]: { body: feedWithout([REFERENCE, OTHER_REFERENCE]) },
    }).fetch;
    const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch });
    await earlierActions.detect();
    const notificationChannel = createFakeNotificationChannel({ errorMessage: ERROR_MESSAGE });
    const actions = await createActions({
      dataDirectory,
      aiSession,
      fetch: createRecordedFetch().fetch,
      notificationChannelList: notificationChannel.notificationChannelList,
    });
    await notificationChannel.saveFor(actions);

    const detectionList = await actions.detect();

    // jf detect prints the new Offres, then each failure, and exits in error
    expect(detectionList[0]?.newOffreList.map(({ reference }) => reference)).toEqual([REFERENCE, OTHER_REFERENCE]);
    // Both notifications were tried
    expect(detectionList[0]?.notificationFailureList).toEqual([
      `Notification « Nouvelle Offre dans la Zone » de l'Offre ${REFERENCE} non envoyée : ${ERROR_MESSAGE}`,
      `Notification « Nouvelle Offre dans la Zone » de l'Offre ${OTHER_REFERENCE} non envoyée : ${ERROR_MESSAGE}`,
    ]);
    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(offreList.map(({ reference }) => reference)).toEqual(expect.arrayContaining([REFERENCE, OTHER_REFERENCE]));
    // The worker, a process of its own, whose notifications go through
    const worker = await createActions({
      dataDirectory,
      aiSession,
      notificationChannelList: createFakeNotificationChannel().notificationChannelList,
    });
    const jobList = await worker.runQueuedJobs();
    expect(jobList).toMatchObject([
      { module: 'recherche', offre: { reference: REFERENCE }, state: 'done' },
      { module: 'recherche', offre: { reference: OTHER_REFERENCE }, state: 'done' },
    ]);
    expect(jobList).toHaveLength(2);
  });

  // lpm never restarts a stopped worker: the failure goes to its log, lpm logs worker
  it('never stops the worker, which logs it and goes on with the queue, each Recherche staying ready', async () => {
    const stderrList: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((text) => {
      stderrList.push(String(text));
      return true;
    });
    const aiSession = createFakeAiSession(RECHERCHE, RECHERCHE);
    const dataDirectory = createDataDirectory();
    const earlierActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await earlierActions.detect();
    const notificationChannel = createFakeNotificationChannel({ errorMessage: ERROR_MESSAGE });
    const actions = await createActions({
      dataDirectory,
      aiSession,
      notificationChannelList: notificationChannel.notificationChannelList,
    });
    await notificationChannel.saveFor(actions);
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: OTHER_REFERENCE });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      { offre: { reference: REFERENCE }, state: 'done', version: { state: 'ready' } },
      { offre: { reference: OTHER_REFERENCE }, state: 'done', version: { state: 'ready' } },
    ]);
    expect(stderrList).toEqual([
      `Notification « Recherche prête » de l'Offre ${REFERENCE} non envoyée : ${ERROR_MESSAGE}\n`,
      `Notification « Recherche prête » de l'Offre ${OTHER_REFERENCE} non envoyée : ${ERROR_MESSAGE}\n`,
    ]);
  });
});

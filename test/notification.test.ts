import { afterEach, describe, expect, it, vi } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, createMigratedDataDirectory, detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel, LEA_TARGET } from './fake-notification-channel.ts';
import { LEA_WATCH } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// The two Béthune Postings, both in the Zone, and an attaché de justice Posting outside it, from the
// responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';
const OUT_OF_ZONE_REFERENCE = '2026-2215099';

const RESEARCH = { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

// A first Detection on the feed as it was before the given Postings were published, then the actions
// for the next one, on the feed as recorded
async function detectBefore(referenceList: string[], aiSession = createFakeAiSession()) {
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
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  return { actions, notificationChannel };
}

// The PEP link of a Posting, as its feed gives it
function linkOf(reference: string): string {
  return `https://choisirleservicepublic.gouv.fr/offre-emploi/${reference}/?tracking=1&idOrigine=502`;
}

const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';
const OTHER_BETHUNE_TITLE =
  "Attaché de justice affecté auprès des magistrats du siège - Service de l'instruction - TJ BETHUNE";

describe('the Detection Summary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells the Candidate, once per Detection, its new Postings in the Zone, when it ran, its Watches and its Near Misses', async () => {
    const { actions, notificationChannel } = await detectBefore([REFERENCE, OTHER_REFERENCE, OUT_OF_ZONE_REFERENCE]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z'));

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([
      {
        target: LEA_TARGET,
        title: '2 nouvelles Offres',
        message:
          `• ${BETHUNE_TITLE} — Tribunal Judiciaire de Béthune\n` +
          `• ${OTHER_BETHUNE_TITLE} — Tribunal Judiciaire de Béthune\n` +
          'Détection du 01/11/2026 07:00 · 4 titres écartés de peu',
        sectionList: [
          {
            heading: 'Nouvelles Offres',
            lineList: [
              {
                text: BETHUNE_TITLE,
                detail: 'Tribunal Judiciaire de Béthune · Date limite : 20/11/2026 · Réf. 2026-2445600',
                url: linkOf(REFERENCE),
              },
              {
                text: OTHER_BETHUNE_TITLE,
                detail: 'Tribunal Judiciaire de Béthune · Date limite : 20/11/2026 · Réf. 2026-2445609',
                url: linkOf(OTHER_REFERENCE),
              },
            ],
          },
          {
            heading: 'Détection',
            lineList: [{ text: 'Lancée le dimanche 1 novembre 2026 à 07:00', detail: 'par jf detect', url: null }],
          },
          {
            heading: 'Veilles',
            lineList: [
              {
                text: 'attaché de justice',
                detail: 'Place de l’Emploi Public · 2 nouvelles Offres · 4 titres écartés de peu',
                url: null,
              },
            ],
          },
          {
            heading: 'Titres écartés de peu',
            lineList: [
              {
                text: "Attaché d'administration- chef de cabinet procureur en charge de la communication   du TJ de Paris",
                detail: 'Réf. 2026-2432800',
                url: linkOf('2026-2432800'),
              },
              {
                text: 'Chef du pôle des attachés de justice et des assistants spécialisés - RHG6 (H/F)',
                detail: 'Réf. 2026-2431315',
                url: linkOf('2026-2431315'),
              },
              {
                text: "Attaché d'administration : CHEF(FE) DE CABINET DU PRESIDENT DU TRIBUNAL DE BETHUNE",
                detail: 'Réf. 2026-2282889',
                url: linkOf('2026-2282889'),
              },
              {
                text: "ATTACHE - CHEF(FE) DE CABINET DE LA PROCUREURE GENERALE DE LA COUR D'APPEL D'ANGERS",
                detail: 'Réf. 2026-2354768',
                url: linkOf('2026-2354768'),
              },
            ],
          },
        ],
      },
    ]);
  });

  // A phone shows a few lines: past 5 Postings, the message counts the others, which the e-mail lists
  it('lists 5 Postings on the phone and counts the others, all of them in its sections', async () => {
    const { actions: detectedActions } = await detectPostings();
    const postingList = await detectedActions.listPostings({ candidateId: 'lea' });
    const inZoneList = postingList.filter(({ isInZone }) => isInZone);
    const { actions, notificationChannel } = await detectBefore(inZoneList.map(({ reference }) => reference));

    await actions.detect();

    const [summary] = notificationChannel.sentList;
    expect(inZoneList.length).toBeGreaterThan(5);
    expect(summary?.message.split('\n')).toHaveLength(7);
    expect(summary?.message).toContain(`\n+${String(inZoneList.length - 5)} autres Offres\nDétection du `);
    expect(summary?.sectionList?.[0]?.lineList).toHaveLength(inZoneList.length);
  });

  it('sends nothing on the first launch, which imports the Postings already online', async () => {
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

describe('the notification of a Research ready', () => {
  it('tells the Candidate which Posting has its Research ready, once the worker has produced it', async () => {
    const { actions, notificationChannel } = await detectPostings(createFakeAiSession(RESEARCH));
    await actions.runModule({ module: 'research', reference: REFERENCE });

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

  it('sends nothing for a Research launched by hand that failed: whoever launched it sees it', async () => {
    const { actions, notificationChannel } = await detectPostings(createFakeAiSession({ isSuccess: false }, {}));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: OTHER_REFERENCE });

    await actions.runQueuedJobs();

    expect(notificationChannel.sentList).toEqual([]);
  });
});

// No one waits in front of the screen for a job the Detection or an extraction queued: its failure
// warns the Candidate, or they would think it still runs (CODING_STANDARDS “Visible failure”)
describe('the notification of a Research queued automatically that failed', () => {
  it('tells the Candidate which Posting has its Research failed, why, and to relaunch it from its page', async () => {
    const { actions, notificationChannel } = await detectBefore([REFERENCE], createFakeAiSession({ isSuccess: false }));
    await actions.detect();
    notificationChannel.sentList.length = 0;

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([{ module: 'research', posting: { reference: REFERENCE }, state: 'failed' }]);
    expect(notificationChannel.sentList).toEqual([
      {
        target: LEA_TARGET,
        title: 'Recherche en échec',
        message:
          'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE\n' +
          'Tribunal Judiciaire de Béthune\n' +
          'La session Claude Code a échoué : son journal dit pourquoi. Relancer le module.\n' +
          `Relancer la Recherche depuis la page de l'Offre ${REFERENCE}.`,
      },
    ]);
  });

  it('tells the Candidate why, in the code of the failure, when the launch of the session throws', async () => {
    const { actions, notificationChannel } = await detectBefore(
      [REFERENCE],
      createFakeAiSession({ errorMessage: 'spawn claude ENOENT' }),
    );
    await actions.detect();
    notificationChannel.sentList.length = 0;

    await actions.runQueuedJobs();

    expect(notificationChannel.sentList).toEqual([
      {
        target: LEA_TARGET,
        title: 'Recherche en échec',
        message:
          'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE\n' +
          'Tribunal Judiciaire de Béthune\n' +
          'Erreur inattendue : spawn claude ENOENT\n' +
          'Relancer ; si elle revient, la signaler avec ce message.\n' +
          `Relancer la Recherche depuis la page de l'Offre ${REFERENCE}.`,
      },
    ]);
  });

  it('tells the Candidate when the Research queued after the extraction of an imported Job Description failed', async () => {
    const extraction = {
      title: 'Greffier placé – Tribunal judiciaire de Lille',
      employer: null,
      workplace: null,
      city: null,
      deadline: null,
      startDate: null,
      applicationEmail: null,
      contact1: null,
      contact2: null,
    };
    const notificationChannel = createFakeNotificationChannel();
    const actions = await createActions({
      dataDirectory: createDataDirectory(),
      aiSession: createFakeAiSession(
        { fileByName: { 'extraction.json': JSON.stringify(extraction) } },
        { isSuccess: false },
      ),
      fetch: createRecordedFetch().fetch,
      notificationChannelList: notificationChannel.notificationChannelList,
    });
    await notificationChannel.saveFor(actions);
    const { posting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: 'greffier-lille.md',
      markdown: '# Greffier placé – Tribunal judiciaire de Lille\n',
    });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      { module: 'extraction', state: 'done' },
      { module: 'research', state: 'failed' },
    ]);
    expect(notificationChannel.sentList).toEqual([
      {
        target: LEA_TARGET,
        title: 'Recherche en échec',
        message:
          'Greffier placé – Tribunal judiciaire de Lille\nJuridiction non précisée\n' +
          'La session Claude Code a échoué : son journal dit pourquoi. Relancer le module.\n' +
          `Relancer la Recherche depuis la page de l'Offre ${posting.reference}.`,
      },
    ]);
  });
});

describe('a notification that cannot be sent', () => {
  const ERROR_MESSAGE = 'Home Assistant injoignable.';

  it('reports the Detection Summary not sent with what the Detection found, once every new Posting is saved and its Research queued', async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession(RESEARCH, RESEARCH);
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

    // jf detect prints the new Postings, then each failure, and exits in error
    expect(detectionList[0]?.newPostingList.map(({ reference }) => reference)).toEqual([REFERENCE, OTHER_REFERENCE]);
    // One Detection Summary tells both, and its failure comes back once
    expect(detectionList[0]?.notificationFailureList).toEqual([
      `Récapitulatif de Détection « 2 nouvelles Offres » non envoyé : ${ERROR_MESSAGE}`,
    ]);
    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(postingList.map(({ reference }) => reference)).toEqual(expect.arrayContaining([REFERENCE, OTHER_REFERENCE]));
    // The worker, a process of its own, whose notifications go through
    const worker = await createActions({
      dataDirectory,
      aiSession,
      notificationChannelList: createFakeNotificationChannel().notificationChannelList,
    });
    const jobList = await worker.runQueuedJobs();
    expect(jobList).toMatchObject([
      { module: 'research', posting: { reference: REFERENCE }, state: 'done' },
      { module: 'research', posting: { reference: OTHER_REFERENCE }, state: 'done' },
    ]);
    expect(jobList).toHaveLength(2);
  });

  // A failure written only to the worker's log, lpm logs worker, would be seen by no one: it stays on
  // the job, whose Posting page shows it (CODING_STANDARDS “Visible failure”)
  it('never stops the worker, which goes on with the queue, each Research staying ready with its notification failure', async () => {
    const aiSession = createFakeAiSession(RESEARCH, RESEARCH);
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
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: OTHER_REFERENCE });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      { posting: { reference: REFERENCE }, state: 'done', version: { state: 'ready' } },
      { posting: { reference: OTHER_REFERENCE }, state: 'done', version: { state: 'ready' } },
    ]);
    const detail = await actions.readPosting({ reference: REFERENCE });
    expect(detail.artifactList.find(({ artifact }) => artifact === 'research')).toMatchObject({
      state: 'ready',
      failure: null,
      notificationFailure: {
        errorCode: 'notification_not_sent',
        message: `Notification « Recherche prête » de l'Offre ${REFERENCE} non envoyée : ${ERROR_MESSAGE}`,
      },
    });
  });

  it('forgets the notification failure of a Research once it is relaunched and notified', async () => {
    const dataDirectory = createDataDirectory();
    const earlierActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await earlierActions.detect();
    const failingChannel = createFakeNotificationChannel({ errorMessage: ERROR_MESSAGE });
    const failingActions = await createActions({
      dataDirectory,
      aiSession: createFakeAiSession(RESEARCH),
      notificationChannelList: failingChannel.notificationChannelList,
    });
    await failingChannel.saveFor(failingActions);
    await failingActions.runModule({ module: 'research', reference: REFERENCE });
    await failingActions.runQueuedJobs();
    const actions = await createActions({
      dataDirectory,
      aiSession: createFakeAiSession(RESEARCH),
      notificationChannelList: createFakeNotificationChannel().notificationChannelList,
    });

    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();

    const detail = await actions.readPosting({ reference: REFERENCE });
    expect(detail.artifactList.find(({ artifact }) => artifact === 'research')).toMatchObject({
      state: 'ready',
      notificationFailure: null,
    });
  });
});

// Emma reads English: her Watch is Léa's, in a data folder of her own
async function detectBeforeForEmma(referenceList: string[]) {
  const dataDirectory = createMigratedDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const earlierActions = await createActions({
    dataDirectory,
    fetch: createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout(referenceList) } }).fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  await earlierActions.createCandidate({ id: 'emma', name: 'Emma', locale: 'en' });
  await earlierActions.saveWatch({ candidateId: 'emma', ...LEA_WATCH });
  await notificationChannel.saveFor(earlierActions, 'emma', EMMA_TARGET);
  await earlierActions.detect();
  const actions = await createActions({
    dataDirectory,
    fetch: createRecordedFetch().fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  return { actions, notificationChannel };
}

const EMMA_TARGET = 'notify.mobile_app_emma';

describe('a notification in the Candidate’s locale', () => {
  it('tells an English-speaking Candidate of a new Posting in English', async () => {
    const { actions, notificationChannel } = await detectBeforeForEmma([REFERENCE]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z'));

    await actions.detect();
    vi.useRealTimers();

    expect(notificationChannel.sentList).toMatchObject([
      {
        target: EMMA_TARGET,
        title: '1 new Posting',
        message: `• ${BETHUNE_TITLE} — Tribunal Judiciaire de Béthune\nDetection of 11/1/26, 7:00 AM · 4 Near Misses`,
        sectionList: [
          {
            heading: 'New Posting',
            lineList: [{ detail: 'Tribunal Judiciaire de Béthune · Deadline: Nov 20, 2026 · Ref. 2026-2445600' }],
          },
          {
            heading: 'Detection',
            lineList: [{ text: 'Started on Sunday, November 1, 2026 at 7:00 AM', detail: 'by jf detect' }],
          },
          { heading: 'Watches' },
          { heading: 'Near Misses' },
        ],
      },
    ]);
  });

  it('tries the Notification Channel of an English-speaking Candidate in English, and Léa’s in French', async () => {
    const { actions, notificationChannel } = await detectBeforeForEmma([]);
    await actions.createCandidate({ id: 'lea', name: 'Léa' });
    await notificationChannel.saveFor(actions);

    await actions.sendTestNotification({ candidateId: 'emma' });
    await actions.sendTestNotification({ candidateId: 'lea' });

    expect(notificationChannel.sentList).toEqual([
      { target: EMMA_TARGET, title: 'Test notification', message: 'Emma’s Notification Channel works.' },
      { target: LEA_TARGET, title: 'Notification de test', message: 'Le Canal de notification de Léa fonctionne.' },
    ]);
  });
});

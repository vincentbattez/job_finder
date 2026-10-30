import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, detectOffres } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeCanalNotification } from './fake-canal-notification.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// The two Béthune Offres, both in the Zone, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';
// An attaché de justice Offre outside the Zone
const OUT_OF_ZONE_REFERENCE = '2026-2215099';

const RECHERCHE = { fileByName: { 'recherche.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

describe('the job queue', () => {
  it('queues the job of a module without launching Claude, and the worker runs it', async () => {
    const aiSession = createFakeAiSession(RECHERCHE);
    const { actions } = await detectOffres(aiSession);

    const queuedJob = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(queuedJob).toMatchObject({ module: 'recherche', state: 'queued', version: null });
    expect(aiSession.headlessSessionList).toEqual([]);
    expect(await actions.runQueuedJobs()).toMatchObject([
      {
        id: queuedJob.id,
        state: 'done',
        version: { artefact: 'recherche', number: 1, state: 'ready', isRetenue: true },
      },
    ]);
    expect(aiSession.headlessSessionList).toHaveLength(1);
  });

  it('runs one job at a time, oldest first, even when the worker is asked twice at once', async () => {
    const aiSession = createFakeAiSession(RECHERCHE, RECHERCHE, RECHERCHE);
    const { actions } = await detectOffres(aiSession);
    const jobIdList: number[] = [];
    for (const reference of [REFERENCE, OTHER_REFERENCE, REFERENCE]) {
      const job = await actions.runModule({ module: 'recherche', reference });
      jobIdList.push(job.id);
    }

    const [jobList, otherJobList] = await Promise.all([actions.runQueuedJobs(), actions.runQueuedJobs()]);

    expect(aiSession.maxSimultaneousSessionCount).toBe(1);
    expect(aiSession.headlessSessionList.map(({ directory }) => path.basename(directory).slice(0, 12))).toEqual([
      REFERENCE,
      OTHER_REFERENCE,
      REFERENCE,
    ]);
    const ranJobList = [...jobList, ...otherJobList].toSorted((left, right) => left.id - right.id);
    expect(ranJobList).toMatchObject([
      { id: jobIdList[0], state: 'done', version: { number: 1 } },
      { id: jobIdList[1], state: 'done', version: { number: 1 } },
      { id: jobIdList[2], state: 'done', version: { number: 2 } },
    ]);
  });

  it('follows a queued job until the worker has run it', async () => {
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE));
    const queuedJob = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    const [followedJob] = await Promise.all([actions.followJob({ jobId: queuedJob.id }), actions.runQueuedJobs()]);

    expect(followedJob).toMatchObject({ id: queuedJob.id, state: 'done', version: { number: 1, state: 'ready' } });
  });

  it('fails a job whose run throws, and goes on with the next one', async () => {
    const aiSession = createFakeAiSession({ errorMessage: 'Disque plein.' }, RECHERCHE);
    const { actions } = await detectOffres(aiSession);
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: OTHER_REFERENCE });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      { offre: { reference: REFERENCE }, state: 'failed', log: 'Disque plein.', version: { state: 'failed' } },
      { offre: { reference: OTHER_REFERENCE }, state: 'done', version: { state: 'ready' } },
    ]);
  });

  it('puts « en échec » the job a stopped worker left running, at its restart, and it can be launched again', async () => {
    const aiSession = createFakeAiSession({ isInterrupted: true }, RECHERCHE);
    const { actions, dataDirectory, notificationChannel } = await detectOffres(aiSession);
    const interruptedJob = await actions.runModule({ module: 'recherche', reference: REFERENCE });
    void actions.runQueuedJobs();
    await vi.waitFor(() => {
      expect(aiSession.headlessSessionList).toHaveLength(1);
    });

    const restartedWorker = await createActions({
      dataDirectory,
      aiSession,
      canalNotificationList: notificationChannel.canalNotificationList,
    });
    const failedJobList = await restartedWorker.failInterruptedJobs();
    await restartedWorker.runModule({ module: 'recherche', reference: REFERENCE });
    await restartedWorker.runQueuedJobs();

    expect(failedJobList).toMatchObject([{ id: interruptedJob.id, state: 'failed', version: { number: 1 } }]);
    expect(failedJobList[0]?.log).toMatch(/worker s'est arrêté/);
    const versionList = await restartedWorker.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, state, isRetenue }) => ({ number, state, isRetenue }))).toEqual([
      { number: 1, state: 'failed', isRetenue: false },
      { number: 2, state: 'ready', isRetenue: true },
    ]);
  });
});

describe('the Recherche of a new Offre in the Zone', () => {
  it('is queued by the Détection, and only for the new Offres in the Zone', async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession(RECHERCHE, RECHERCHE);
    const feed = feedWithout([REFERENCE, OTHER_REFERENCE, OUT_OF_ZONE_REFERENCE]);
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feed } }).fetch;
    const notificationChannel = createFakeCanalNotification();
    const earlierActions = await createActions({
      dataDirectory,
      aiSession,
      fetch: earlierFetch,
      canalNotificationList: notificationChannel.canalNotificationList,
    });
    await notificationChannel.saveFor(earlierActions);
    await earlierActions.detect();
    const actions = await createActions({
      dataDirectory,
      aiSession,
      fetch: createRecordedFetch().fetch,
      canalNotificationList: notificationChannel.canalNotificationList,
    });

    await actions.detect();

    const jobList = await actions.runQueuedJobs();
    const queuedList = jobList.map((job) => `${job.module} ${'offre' in job ? job.offre.reference : job.upload}`);
    expect(queuedList.toSorted((left, right) => left.localeCompare(right))).toEqual([
      `recherche ${REFERENCE}`,
      `recherche ${OTHER_REFERENCE}`,
    ]);
  });

  it('is not queued on the first launch, which imports the Offres already online', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectOffres(aiSession);

    expect(await actions.runQueuedJobs()).toEqual([]);
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});

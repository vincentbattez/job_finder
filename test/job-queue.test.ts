import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// The two Béthune Postings, both in the Zone, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';
// An attaché de justice Posting outside the Zone
const OUT_OF_ZONE_REFERENCE = '2026-2215099';

const RESEARCH = { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

describe('the job queue', () => {
  it('queues the job of a module without launching Claude, and the worker runs it', async () => {
    const aiSession = createFakeAiSession(RESEARCH);
    const { actions } = await detectPostings(aiSession);

    const queuedJob = await actions.runModule({ module: 'research', reference: REFERENCE });

    expect(queuedJob).toMatchObject({ module: 'research', state: 'queued', version: null });
    expect(aiSession.headlessSessionList).toEqual([]);
    expect(await actions.runQueuedJobs()).toMatchObject([
      {
        id: queuedJob.id,
        state: 'done',
        version: { artifact: 'research', number: 1, state: 'ready', isChosen: true },
      },
    ]);
    expect(aiSession.headlessSessionList).toHaveLength(1);
  });

  it('runs one job at a time, oldest first, even when the worker is asked twice at once', async () => {
    const aiSession = createFakeAiSession(RESEARCH, RESEARCH, RESEARCH);
    const { actions } = await detectPostings(aiSession);
    const jobIdList: number[] = [];
    for (const reference of [REFERENCE, OTHER_REFERENCE, REFERENCE]) {
      const job = await actions.runModule({ module: 'research', reference });
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
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH));
    const queuedJob = await actions.runModule({ module: 'research', reference: REFERENCE });

    const [followedJob] = await Promise.all([actions.followJob({ jobId: queuedJob.id }), actions.runQueuedJobs()]);

    expect(followedJob).toMatchObject({ id: queuedJob.id, state: 'done', version: { number: 1, state: 'ready' } });
  });

  it('fails a job whose run throws, and goes on with the next one', async () => {
    const aiSession = createFakeAiSession({ errorMessage: 'Disque plein.' }, RESEARCH);
    const { actions } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: OTHER_REFERENCE });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      { posting: { reference: REFERENCE }, state: 'failed', log: 'Disque plein.', version: { state: 'failed' } },
      { posting: { reference: OTHER_REFERENCE }, state: 'done', version: { state: 'ready' } },
    ]);
  });

  it('puts « en échec » the job a stopped worker left running, at its restart, and it can be launched again', async () => {
    const aiSession = createFakeAiSession({ isInterrupted: true }, RESEARCH);
    const { actions, dataDirectory, notificationChannel } = await detectPostings(aiSession);
    const interruptedJob = await actions.runModule({ module: 'research', reference: REFERENCE });
    void actions.runQueuedJobs();
    await vi.waitFor(() => {
      expect(aiSession.headlessSessionList).toHaveLength(1);
    });

    const restartedWorker = await createActions({
      dataDirectory,
      aiSession,
      notificationChannelList: notificationChannel.notificationChannelList,
    });
    const failedJobList = await restartedWorker.failInterruptedJobs();
    await restartedWorker.runModule({ module: 'research', reference: REFERENCE });
    await restartedWorker.runQueuedJobs();

    expect(failedJobList).toMatchObject([{ id: interruptedJob.id, state: 'failed', version: { number: 1 } }]);
    expect(failedJobList[0]?.log).toMatch(/worker s'est arrêté/);
    const versionList = await restartedWorker.listVersions({ reference: REFERENCE, artifact: 'research' });
    expect(versionList.map(({ number, state, isChosen }) => ({ number, state, isChosen }))).toEqual([
      { number: 1, state: 'failed', isChosen: false },
      { number: 2, state: 'ready', isChosen: true },
    ]);
  });
});

describe('the Research of a new Posting in the Zone', () => {
  it('is queued by the Detection, and only for the new Postings in the Zone', async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession(RESEARCH, RESEARCH);
    const feed = feedWithout([REFERENCE, OTHER_REFERENCE, OUT_OF_ZONE_REFERENCE]);
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feed } }).fetch;
    const notificationChannel = createFakeNotificationChannel();
    const earlierActions = await createActions({
      dataDirectory,
      aiSession,
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

    await actions.detect();

    const jobList = await actions.runQueuedJobs();
    const queuedList = jobList.map((job) => `${job.module} ${'posting' in job ? job.posting.reference : job.upload}`);
    expect(queuedList.toSorted((left, right) => left.localeCompare(right))).toEqual([
      `research ${REFERENCE}`,
      `research ${OTHER_REFERENCE}`,
    ]);
  });

  it('is not queued on the first launch, which imports the Postings already online', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectPostings(aiSession);

    expect(await actions.runQueuedJobs()).toEqual([]);
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});

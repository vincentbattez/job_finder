import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { applyTo } from './apply.ts';
import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The two Béthune Postings, both in the Zone, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';

const RESEARCH = { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

const MINUTE_MS = 60_000;

function moveClockBy(durationMs: number): void {
  vi.setSystemTime(Date.now() + durationMs);
}

async function researchOf(actions: Actions, reference = REFERENCE) {
  const { artifactList } = await actions.readPosting({ reference });
  const research = artifactList.find(({ artifact }) => artifact === 'research');
  return { state: research?.state, workerFailure: research?.workerFailure };
}

afterEach(() => {
  vi.useRealTimers();
});

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
    await actions.beatWorker();

    const [followedJob] = await Promise.all([actions.followJob({ jobId: queuedJob.id }), actions.runQueuedJobs()]);

    expect(followedJob).toMatchObject({ id: queuedJob.id, state: 'done', version: { number: 1, state: 'ready' } });
  });

  // A library exception, such as a full disk, reaches the Candidate under a code, in French
  it('fails a job whose run throws, under the code of an unexpected error, and goes on with the next one', async () => {
    const aiSession = createFakeAiSession({ errorMessage: 'Disque plein.' }, RESEARCH);
    const { actions } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: OTHER_REFERENCE });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      {
        posting: { reference: REFERENCE },
        state: 'failed',
        errorCode: 'unexpected',
        log: 'Erreur inattendue : Disque plein.\nRelancer ; si elle revient, la signaler avec ce message.',
        version: { state: 'failed' },
      },
      { posting: { reference: OTHER_REFERENCE }, state: 'done', version: { state: 'ready' } },
    ]);
  });

  // A session that never returns would hold the queue: stopped, it fails its job only
  it('fails a session stopped past its maximum duration under its code, and goes on with the next job', async () => {
    const log = 'La session Claude Code a dépassé sa durée maximale (30 minutes) : elle a été arrêtée.';
    const aiSession = createFakeAiSession({ errorCode: 'session_timed_out', log }, RESEARCH);
    const { actions } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: OTHER_REFERENCE });

    const jobList = await actions.runQueuedJobs();

    expect(jobList).toMatchObject([
      { posting: { reference: REFERENCE }, state: 'failed', errorCode: 'session_timed_out', log },
      { posting: { reference: OTHER_REFERENCE }, state: 'done' },
    ]);
    const { failure } = await actions.readArtifactState({ reference: REFERENCE, artifact: 'research' });
    expect(failure).toEqual({ errorCode: 'session_timed_out', log });
  });

  it('tells a queued job apart from a running one', async () => {
    const aiSession = createFakeAiSession({ isInterrupted: true });
    const { actions } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: OTHER_REFERENCE });
    await actions.beatWorker();

    expect(await researchOf(actions)).toEqual({ state: 'queued', workerFailure: null });
    void actions.runQueuedJobs();
    await vi.waitFor(() => {
      expect(aiSession.headlessSessionList).toHaveLength(1);
    });

    expect(await researchOf(actions)).toEqual({ state: 'in_progress', workerFailure: null });
    expect(await researchOf(actions, OTHER_REFERENCE)).toEqual({ state: 'queued', workerFailure: null });
  });

  // The worker never started, crashed, or was stopped by lpm stop: nothing else would tell
  it('tells, on the Posting and to whoever follows the job, that no worker is running, and how to start it', async () => {
    const { actions } = await detectPostings();
    const job = await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.beatWorker();

    moveClockBy(2 * MINUTE_MS);

    const message = `Le worker ne tourne pas : le job ${String(job.id)} n'avance pas. Le démarrer : « lpm service worker start -p job_finder », puis lire « lpm logs worker -p job_finder » s'il s'arrête encore.`;
    expect(await researchOf(actions)).toEqual({
      state: 'queued',
      workerFailure: { errorCode: 'worker_not_running', message },
    });
    await expect(actions.followJob({ jobId: job.id })).rejects.toMatchObject({ code: 'worker_not_running', message });
  });

  it('tells that no worker is running when none ever started', async () => {
    const { actions } = await detectPostings();
    const job = await actions.runModule({ module: 'research', reference: REFERENCE });

    await expect(actions.followJob({ jobId: job.id })).rejects.toMatchObject({ code: 'worker_not_running' });
  });

  it('stops following a job that runs past its maximum duration, the worker being stuck', async () => {
    const aiSession = createFakeAiSession({ isInterrupted: true });
    const { actions } = await detectPostings(aiSession);
    const job = await actions.runModule({ module: 'research', reference: REFERENCE });
    void actions.runQueuedJobs();
    await vi.waitFor(() => {
      expect(aiSession.headlessSessionList).toHaveLength(1);
    });

    moveClockBy(40 * MINUTE_MS);
    await actions.beatWorker();

    await expect(actions.followJob({ jobId: job.id })).rejects.toMatchObject({ code: 'job_overdue' });
    await expect(actions.followJob({ jobId: job.id })).rejects.toThrow(/lpm service worker restart -p job_finder/);
    expect(await researchOf(actions)).toMatchObject({ workerFailure: { errorCode: 'job_overdue' } });
  });

  // The job overdue is the running one: the job queued behind it waits, which says nothing of it
  it('tells that a job is overdue under its Artifact only, and in jf versions', async () => {
    const aiSession = createFakeAiSession(RESEARCH, { isInterrupted: true });
    const { actions } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await applyTo(actions, REFERENCE);
    await actions.addInterview({ reference: REFERENCE, start: '2026-11-19T14:00', place: '', interviewers: '' });
    await actions.runModule({ module: 'interview_brief', reference: REFERENCE, interview: 1 });
    await actions.runModule({ module: 'research', reference: REFERENCE });
    void actions.runQueuedJobs();
    await vi.waitFor(() => {
      expect(aiSession.headlessSessionList).toHaveLength(2);
    });

    moveClockBy(40 * MINUTE_MS);
    await actions.beatWorker();

    const { artifactList, interviewList } = await actions.readPosting({ reference: REFERENCE });
    expect(
      [...artifactList, ...(interviewList[0]?.artifactList ?? [])].map(({ artifact, state, workerFailure }) => ({
        artifact,
        state,
        errorCode: workerFailure?.errorCode ?? null,
      })),
    ).toEqual([
      { artifact: 'research', state: 'queued', errorCode: null },
      { artifact: 'letter', state: 'absent', errorCode: null },
      { artifact: 'portrait', state: 'absent', errorCode: null },
      { artifact: 'interview_brief', state: 'in_progress', errorCode: 'job_overdue' },
    ]);
    expect(
      await actions.readArtifactState({ reference: REFERENCE, artifact: 'interview_brief', interview: 1 }),
    ).toMatchObject({
      state: 'in_progress',
      workerFailure: { errorCode: 'job_overdue', message: /lpm service worker restart/ },
    });
  });

  it('tells in jf versions that no worker runs the last job of an Artifact', async () => {
    const { actions } = await detectPostings();
    await actions.runModule({ module: 'research', reference: REFERENCE });

    expect(await actions.readArtifactState({ reference: REFERENCE, artifact: 'research' })).toMatchObject({
      state: 'queued',
      workerFailure: { errorCode: 'worker_not_running' },
    });
  });

  it('fails the job a stopped worker left running, at its restart, and it can be launched again', async () => {
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

    expect(failedJobList).toMatchObject([
      { id: interruptedJob.id, state: 'failed', errorCode: 'interrupted_job', version: { number: 1 } },
    ]);
    expect(failedJobList[0]?.log).toMatch(/worker s'est arrêté/);
    const versionList = await restartedWorker.listVersions({ reference: REFERENCE, artifact: 'research' });
    expect(versionList.map(({ number, state, isChosen }) => ({ number, state, isChosen }))).toEqual([
      { number: 1, state: 'failed', isChosen: false },
      { number: 2, state: 'ready', isChosen: true },
    ]);
  });
});

// No Detection starts a Research: the Candidate keeps the Postings worth one (ADR-0018)
describe('the Research of a detected Posting', () => {
  it('is queued once the Candidate keeps the Posting, and run by the worker', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH));

    await actions.keep({ reference: REFERENCE });

    const jobList = await actions.runQueuedJobs();
    expect(jobList).toMatchObject([{ module: 'research', posting: { reference: REFERENCE }, state: 'done' }]);
  });

  it('is not queued on the first launch, which imports the Postings already online', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectPostings(aiSession);

    expect(await actions.runQueuedJobs()).toEqual([]);
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});

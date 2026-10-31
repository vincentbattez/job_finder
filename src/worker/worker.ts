import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { DEFAULT_LOCALE, localeOf, tFor } from '#/actions/i18n.ts';
import { createActions, formatError, formatFailure, type Actions } from '#/actions/index.ts';
import { WORKER_BEAT_INTERVAL_MS } from '#/actions/stalled-job.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// How often the worker looks for queued jobs
const POLL_INTERVAL_MS = 2000;

// Through the actions only: the worker never reaches the domain directly (ADR-0003)
type Job = Awaited<ReturnType<Actions['runQueuedJobs']>>[number];

// In the locale of the Candidate of the job, that of its Upload or of its Posting
async function formatJobs(actions: Actions, jobList: Job[]): Promise<string> {
  const candidateList = await actions.listCandidates();
  const tOf = (candidateId: string) => tFor(localeOf(candidateList.find(({ id }) => id === candidateId)), 'cli');
  return jobList
    .map((job) => {
      const failure = (t: ReturnType<typeof tOf>) => t('jobFailed', { firstLine: job.log.split('\n', 1)[0] ?? '' });
      if (job.module === 'conversion') {
        const t = tOf(job.candidateId);
        const outcome = job.state === 'done' ? t('conversionDone') : failure(t);
        return t('conversionJob', { jobId: job.id, upload: job.upload, candidateId: job.candidateId, outcome });
      }
      const { id, module, posting, state, version, notificationErrorCode, notificationFailure } = job;
      const t = tOf(posting.candidateId);
      const artifact = version === null ? module : `${module} v${String(version.number)}`;
      const outcome = state === 'done' ? t('artifactDone') : failure(t);
      // Also kept on the job, which the Posting page shows: the log only helps whoever reads it
      const notificationLine =
        notificationErrorCode === null
          ? ''
          : `${formatFailure({ code: notificationErrorCode, message: notificationFailure ?? '' })}\n`;
      return t('artifactJob', { jobId: id, artifact, reference: posting.reference, outcome }) + notificationLine;
    })
    .join('');
}

// In its own process, so restarting the front never stops a session (ADR-0003)
async function work(): Promise<never> {
  const actions = await createActions({ dataDirectory: DATA_DIRECTORY });
  // On a timer, so that it goes on during a session: the Posting page and jf run --wait tell a job no
  // worker runs from one that waits (#41)
  const beat = async () => {
    try {
      await actions.beatWorker();
    } catch (error) {
      process.stderr.write(`${formatError(error)}\n`);
    }
  };
  await beat();
  setInterval(() => void beat(), WORKER_BEAT_INTERVAL_MS);
  process.stdout.write(await formatJobs(actions, await actions.failInterruptedJobs()));
  // Before any job, no Candidate: in the default locale
  process.stdout.write(tFor(DEFAULT_LOCALE, 'cli')('workerReady'));
  for (;;) {
    process.stdout.write(await formatJobs(actions, await actions.runQueuedJobs()));
    await setTimeout(POLL_INTERVAL_MS);
  }
}

try {
  await work();
} catch (error) {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}

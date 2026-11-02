import { setTimeout } from 'node:timers/promises';

import { z } from 'zod/v4';

import type { JobFailure } from '#/artifact/index.ts';
import { codedError, codedErrorOf } from '#/domain/coded-error.ts';
import type { Job, QueuedJob } from '#/domain/index.ts';
import {
  composeResearchFailedNotification,
  composeResearchReadyNotification,
  type NotificationComposer,
} from '#/notification/index.ts';

import type { ActionContext } from './context.ts';
import { runExtraction } from './import-job-description.ts';
import { findJobStall } from './stalled-job.ts';
import { runConversion } from './uploads.ts';

// The Interview, by its number on the Posting, for a module attached to one
const MODULE_INPUT_SCHEMA = z.object({
  module: z.string(),
  reference: z.string(),
  interview: z.coerce.number().int().optional(),
});
const JOB_INPUT_SCHEMA = z.object({ jobId: z.coerce.number().int() });

// How often a followed job is read again: a module runs for minutes
const FOLLOW_INTERVAL_MS = 1000;

// A ready Research is notified. A failed one only when automatic: whoever launched it by hand sees
// it fail, while no one waits for one the Detection or an extraction queued.
function composeFinishedNotification(job: Job, failure: JobFailure | undefined): NotificationComposer | null {
  if (job.state === 'done') {
    return composeResearchReadyNotification(job.posting);
  }
  return failure !== undefined && job.isAutomatic
    ? composeResearchFailedNotification(job.posting, failure.message)
    : null;
}

export function createJobActions(context: ActionContext) {
  const { workspace, artifacts, findPosting, findLocale, notify } = context;

  // A notification not sent stays on the job, which the Posting page shows (CODING_STANDARDS
  // “Visible failure”)
  async function notifyFinished(job: QueuedJob, failure: JobFailure | undefined): Promise<QueuedJob> {
    if (job.module !== 'research') {
      return job;
    }
    const composeNotification = composeFinishedNotification(job, failure);
    const notificationFailure =
      composeNotification === null ? undefined : await notify(job.posting, composeNotification);
    return notificationFailure === undefined ? job : workspace.failNotification(job, notificationFailure);
  }

  return {
    // Only queues the job: the worker runs it, so restarting the front never stops a session
    // (ADR-0003)
    async runModule(rawInput: unknown): Promise<Job> {
      const { module, reference, interview } = MODULE_INPUT_SCHEMA.parse(rawInput);
      // The extraction of an imported Posting runs again after a failure
      if (module === 'extraction') {
        const posting = await findPosting(reference);
        if (posting.source !== 'import') {
          throw codedError('not_imported', { reference }, { locale: await findLocale(posting.candidateId) });
        }
        return workspace.createJob(posting, 'extraction');
      }
      const handle = await artifacts.find({ reference, module, interview });
      return handle.queueRun();
    },

    async followJob(rawInput: unknown): Promise<Job> {
      const { jobId } = JOB_INPUT_SCHEMA.parse(rawInput);
      for (;;) {
        const job = await workspace.findJob(jobId);
        // Before the job is found, no Candidate tells the locale: the default one
        if (job === null) {
          throw codedError('unknown_job', { jobId });
        }
        if (job.state === 'done' || job.state === 'failed') {
          return job;
        }
        // A job no worker moves would be followed forever
        const stall = await findJobStall(workspace, job, await findLocale(job.posting.candidateId));
        if (stall !== undefined) {
          throw stall;
        }
        await setTimeout(FOLLOW_INTERVAL_MS);
      }
    },

    // The worker tells it runs, while it waits for jobs as during a session
    async beatWorker(): Promise<void> {
      await workspace.beatWorker();
    },

    // At the worker's start, a running job was cut off by its stop: failing it frees the queue
    async failInterruptedJobs(): Promise<QueuedJob[]> {
      return workspace.failRunningJobs((locale) => codedError('interrupted_job', {}, { locale }));
    },

    // One job at a time, a single Claude session (ADR-0003)
    async runQueuedJobs(): Promise<QueuedJob[]> {
      const jobList: QueuedJob[] = [];
      for (let job = await workspace.claimNextJob(); job !== null; job = await workspace.claimNextJob()) {
        try {
          if (job.module === 'conversion') {
            jobList.push(await runConversion(context, job));
            continue;
          }
          const { module } = job;
          const { job: finishedJob, failure } =
            module === 'extraction'
              ? { ...(await runExtraction(context, job)), failure: undefined }
              : await artifacts.run({ ...job, module });
          jobList.push(await notifyFinished(finishedJob, failure));
        } catch (error) {
          // An error fails this job only, the one running, and the worker goes on with the queue
          const failedList = await workspace.failRunningJobs((locale) => codedErrorOf(error, locale));
          for (const failedJob of failedList) {
            // A conversion belongs to a Profile, not a Posting: its Candidate is on the job itself
            const candidateId =
              failedJob.module === 'conversion' ? failedJob.candidateId : failedJob.posting.candidateId;
            const locale = await findLocale(candidateId);
            jobList.push(await notifyFinished(failedJob, codedErrorOf(error, locale)));
          }
        }
      }
      return jobList;
    },
  };
}

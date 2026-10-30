import { setTimeout } from 'node:timers/promises';

import { z } from 'zod/v4';

import { defaultErrorTranslator, tFor } from '#/domain/catalogue/i18n.ts';
import type { Job, QueuedJob } from '#/domain/index.ts';
import { composeResearchReadyNotification } from '#/notification/index.ts';
import { messageOf } from '#/text/index.ts';

import type { ActionContext } from './context.ts';
import { runExtraction } from './import-job-description.ts';
import { findInputs, parseModule } from './run-job.ts';
import { runConversion } from './uploads.ts';

const MODULE_INPUT_SCHEMA = z.object({ module: z.string(), reference: z.string() });
const JOB_INPUT_SCHEMA = z.object({ jobId: z.coerce.number().int() });

// How often a followed job is read again: a module runs for minutes
const FOLLOW_INTERVAL_MS = 1000;

export function createJobActions(context: ActionContext) {
  const { workspace, runJob, findPosting, findLocale, notify } = context;
  return {
    // Only queues the job: the worker runs it, so restarting the front never stops a session
    // (ADR-0003)
    async runModule(rawInput: unknown): Promise<Job> {
      const { module, reference } = MODULE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      // The extraction of an imported Posting runs again after a failure
      if (module === 'extraction') {
        if (posting.source !== 'import') {
          throw new Error(tFor(locale, 'error')('notImported', { reference }));
        }
        return workspace.createJob(posting, 'extraction');
      }
      const artifact = parseModule(module, locale);
      await findInputs(workspace, posting, artifact, locale);
      return workspace.createJob(posting, artifact);
    },

    async followJob(rawInput: unknown): Promise<Job> {
      const { jobId } = JOB_INPUT_SCHEMA.parse(rawInput);
      for (;;) {
        const job = await workspace.findJob(jobId);
        // Before the job is found, no Candidate tells the locale: the default one
        if (job === null) {
          throw new Error(defaultErrorTranslator()('unknownJob', { jobId }));
        }
        if (job.state === 'done' || job.state === 'failed') {
          return job;
        }
        await setTimeout(FOLLOW_INTERVAL_MS);
      }
    },

    // At the worker's start, a running job was cut off by its stop: failing it frees the queue
    async failInterruptedJobs(): Promise<QueuedJob[]> {
      return workspace.failRunningJobs((locale) => tFor(locale, 'error')('interruptedJob'));
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
          const { job: finishedJob } =
            module === 'extraction'
              ? await runExtraction(context, job)
              : await runJob({ ...job, module }, await findLocale(job.posting.candidateId));
          jobList.push(finishedJob);
          if (finishedJob.module === 'research' && finishedJob.state === 'done') {
            const failure = await notify(finishedJob.posting, composeResearchReadyNotification(finishedJob.posting));
            // Logged, in lpm logs worker: lpm never restarts a stopped worker, and the job is done
            if (failure !== undefined) {
              process.stderr.write(`${failure}\n`);
            }
          }
        } catch (error) {
          // An error fails this job only, the one running, and the worker goes on with the queue
          jobList.push(...(await workspace.failRunningJobs(() => messageOf(error))));
        }
      }
      return jobList;
    },
  };
}

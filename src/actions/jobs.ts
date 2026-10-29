import { setTimeout } from 'node:timers/promises';

import { z } from 'zod/v4';

import type { Job } from '#/domain/index.ts';
import { composeRecherchePreteNotification } from '#/modules/notification/index.ts';
import { messageOf } from '#/text/index.ts';

import type { ActionContext } from './context.ts';
import { runExtraction } from './import-fiche-de-poste.ts';
import { findInputs, parseModule } from './run-job.ts';

const MODULE_INPUT_SCHEMA = z.object({ module: z.string(), reference: z.string() });
const JOB_INPUT_SCHEMA = z.object({ jobId: z.coerce.number().int() });

// How often a followed job is read again: a module runs for minutes
const FOLLOW_INTERVAL_MS = 1000;

export function createJobActions(context: ActionContext) {
  const { workspace, runJob, findOffre, notify } = context;
  return {
    // Only queues the job: the worker runs it, so restarting the front never stops a session
    // (ADR-0003)
    async runModule(rawInput: unknown): Promise<Job> {
      const { module, reference } = MODULE_INPUT_SCHEMA.parse(rawInput);
      // The extraction of an imported Offre runs again after a failure
      if (module === 'extraction') {
        const offre = await findOffre(reference);
        if (offre.source !== 'import') {
          throw new Error(
            `L'Offre ${reference} n'a pas été importée : ses champs viennent de sa Source, sans extraction.`,
          );
        }
        return workspace.createJob(offre, 'extraction');
      }
      const artefact = parseModule(module);
      const offre = await findOffre(reference);
      await findInputs(workspace, offre, artefact);
      return workspace.createJob(offre, artefact);
    },

    async followJob(rawInput: unknown): Promise<Job> {
      const { jobId } = JOB_INPUT_SCHEMA.parse(rawInput);
      for (;;) {
        const job = await workspace.findJob(jobId);
        if (job === null) {
          throw new Error(
            `Job inconnu : ${String(jobId)}. Son numéro est celui que « jf run » ou « jf import » a affiché.`,
          );
        }
        if (job.state === 'done' || job.state === 'failed') {
          return job;
        }
        await setTimeout(FOLLOW_INTERVAL_MS);
      }
    },

    // At the worker's start, a running job was cut off by its stop: failing it frees the queue
    async failInterruptedJobs(): Promise<Job[]> {
      return workspace.failRunningJobs(
        "Interrompu : le worker s'est arrêté pendant ce job. Relancer le module en crée une nouvelle Version.",
      );
    },

    // One job at a time, a single Claude session (ADR-0003)
    async runQueuedJobs(): Promise<Job[]> {
      const jobList: Job[] = [];
      for (let job = await workspace.claimNextJob(); job !== null; job = await workspace.claimNextJob()) {
        try {
          const { module } = job;
          const { job: finishedJob } =
            module === 'extraction' ? await runExtraction(context, job) : await runJob({ ...job, module });
          jobList.push(finishedJob);
          if (finishedJob.module === 'recherche' && finishedJob.state === 'done') {
            const failure = await notify(finishedJob.offre, composeRecherchePreteNotification(finishedJob.offre));
            // Logged, in lpm logs worker: lpm never restarts a stopped worker, and the job is done
            if (failure !== undefined) {
              process.stderr.write(`${failure}\n`);
            }
          }
        } catch (error) {
          // An error fails this job only, the one running, and the worker goes on with the queue
          jobList.push(...(await workspace.failRunningJobs(messageOf(error))));
        }
      }
      return jobList;
    },
  };
}

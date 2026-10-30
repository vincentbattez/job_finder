import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { createActions, messageOf, type Actions } from '#/actions/index.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// How often the worker looks for queued jobs
const POLL_INTERVAL_MS = 2000;

// Through the actions only: the worker never reaches the domain directly (ADR-0003)
type Job = Awaited<ReturnType<Actions['runQueuedJobs']>>[number];

function formatJob(job: Job): string {
  const failure = `en échec : ${job.log.split('\n', 1)[0] ?? ''}`;
  if (job.module === 'conversion') {
    const outcome = job.state === 'done' ? 'rangée dans le Profil' : failure;
    return `job ${String(job.id)}, conversion de la Pièce ${job.piece} de ${job.candidatId} : ${outcome}\n`;
  }
  const { id, module, offre, state, version } = job;
  const artefact = version === null ? module : `${module} v${String(version.number)}`;
  const outcome = state === 'done' ? 'prête et retenue' : failure;
  return `job ${String(id)}, ${artefact} de l'Offre ${offre.reference} : ${outcome}\n`;
}

// In its own process, so restarting the front never stops a session (ADR-0003)
async function work(): Promise<never> {
  const actions = await createActions({ dataDirectory: DATA_DIRECTORY });
  const interruptedJobList = await actions.failInterruptedJobs();
  for (const job of interruptedJobList) {
    process.stdout.write(formatJob(job));
  }
  process.stdout.write('Worker prêt : il lance les jobs en file, un à la fois.\n');
  for (;;) {
    const jobList = await actions.runQueuedJobs();
    for (const job of jobList) {
      process.stdout.write(formatJob(job));
    }
    await setTimeout(POLL_INTERVAL_MS);
  }
}

try {
  await work();
} catch (error) {
  process.stderr.write(`${messageOf(error)}\n`);
  process.exitCode = 1;
}

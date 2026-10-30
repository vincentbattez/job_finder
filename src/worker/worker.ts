import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { catalogueOf, type Catalogue } from '#/actions/catalogue.ts';
import { createActions, messageOf, type Actions } from '#/actions/index.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// How often the worker looks for queued jobs
const POLL_INTERVAL_MS = 2000;

// Through the actions only: the worker never reaches the domain directly (ADR-0003)
type Job = Awaited<ReturnType<Actions['runQueuedJobs']>>[number];

// In the locale of the Candidate of the job, that of its Upload or of its Posting
async function formatJobs(actions: Actions, jobList: Job[]): Promise<string> {
  const candidateList = await actions.listCandidates();
  const cliOf = (candidateId: string): Catalogue['cli'] =>
    catalogueOf(candidateList.find(({ id }) => id === candidateId)).cli;
  return jobList
    .map((job) => {
      const failure = (cli: Catalogue['cli']) => cli.jobFailed(job.log.split('\n', 1)[0] ?? '');
      if (job.module === 'conversion') {
        const cli = cliOf(job.candidateId);
        const outcome = job.state === 'done' ? cli.conversionDone : failure(cli);
        return cli.conversionJob(job.id, job.upload, job.candidateId, outcome);
      }
      const { id, module, posting, state, version } = job;
      const cli = cliOf(posting.candidateId);
      const artifact = version === null ? module : `${module} v${String(version.number)}`;
      const outcome = state === 'done' ? cli.artifactDone : failure(cli);
      return cli.artifactJob(id, artifact, posting.reference, outcome);
    })
    .join('');
}

// In its own process, so restarting the front never stops a session (ADR-0003)
async function work(): Promise<never> {
  const actions = await createActions({ dataDirectory: DATA_DIRECTORY });
  process.stdout.write(await formatJobs(actions, await actions.failInterruptedJobs()));
  // Before any job, no Candidate: in the default locale
  process.stdout.write(catalogueOf(null).cli.workerReady);
  for (;;) {
    process.stdout.write(await formatJobs(actions, await actions.runQueuedJobs()));
    await setTimeout(POLL_INTERVAL_MS);
  }
}

try {
  await work();
} catch (error) {
  process.stderr.write(`${messageOf(error)}\n`);
  process.exitCode = 1;
}

import type { Actions } from '#/actions/index.ts';

// Launching a module queues its job, which the worker runs (ADR-0003); the Candidate then validates its
// Draft, so that the next Artifacts read it (ADR-0019)
export async function runAndValidate(
  actions: Actions,
  { module, reference, interview }: { module: string; reference: string; interview?: number | undefined },
) {
  const { id } = await actions.runModule({ module, reference, interview });
  await actions.runQueuedJobs();
  const { version } = await actions.followJob({ jobId: id });
  if (version?.state === 'ready') {
    await actions.validateVersion({ reference, artifact: module, interview, number: version.number });
  }
  return actions.followJob({ jobId: id });
}

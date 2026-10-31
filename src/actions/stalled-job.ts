import { MAX_SESSION_DURATION_MS } from '#/ai-session/acl/claude-code.ts';
import { codedError, type CodedError } from '#/domain/coded-error.ts';
import type { Job, Locale } from '#/domain/index.ts';
import type { Workspace } from '#/workspace/index.ts';

// How often the worker tells it runs, even during a session; silent for longer, it is taken for stopped
export const WORKER_BEAT_INTERVAL_MS = 10_000;
const WORKER_SILENCE_MS = 6 * WORKER_BEAT_INTERVAL_MS;
// Past the maximum duration of its session and the time to read what it wrote, a running job is stuck
const MAX_JOB_DURATION_MS = MAX_SESSION_DURATION_MS + 5 * 60_000;

// A job the worker has yet to finish, whether it waits in the queue or runs
function isPendingJob({ state }: Job): boolean {
  return state === 'queued' || state === 'running';
}

// Why a queued or running job makes no progress, so that the Posting page and jf run --wait say it
// rather than "Running" forever; undefined while it moves, or once it is over (CODING_STANDARDS
// “Visible failure”)
export async function findJobStall(workspace: Workspace, job: Job, locale: Locale): Promise<CodedError | undefined> {
  if (!isPendingJob(job)) {
    return undefined;
  }
  const beatAt = await workspace.findWorkerBeat();
  const now = Date.now();
  if (beatAt === null || now - beatAt.getTime() > WORKER_SILENCE_MS) {
    return codedError('worker_not_running', { jobId: job.id }, { locale });
  }
  if (job.startedAt !== null && now - job.startedAt.getTime() > MAX_JOB_DURATION_MS) {
    const minutes = String(Math.round(MAX_JOB_DURATION_MS / 60_000));
    return codedError('job_overdue', { jobId: job.id, minutes }, { locale });
  }
  return undefined;
}

import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { isPending } from '#/actions/state.ts';
import { StateBadge } from '#/web/components/badge.tsx';
import type { IArtifactVersions } from '#/web/components/posting-detail.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import { WorkerTask } from '#/web/components/worker-task.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { InterviewField } from './interview-field.tsx';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// The button of the module that produces an Artifact, beside its state. The worker runs the job in
// its own process (ADR-0003), so the Posting page reads the state again until the job is done, and
// says when no worker moves it.
export function ModuleLaunch({
  reference,
  interviewNumber,
  artifact,
  state,
  failure,
  notificationFailure,
  module,
  workerFailure,
}: Readonly<
  Pick<IArtifactVersions, 'artifact' | 'state' | 'failure' | 'notificationFailure' | 'workerFailure' | 'module'> & {
    reference: string;
    interviewNumber: number | null;
  }
>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal>();
  const isHydrated = useIsHydrated();
  const isRunning = isPending(state);
  useRevalidateWhile(isRunning);
  // The refusal of a relaunch, else why the last job failed, else why the worker does not move it,
  // else why its notification was not sent: the Candidate was not warned (CODING_STANDARDS “Visible
  // failure”)
  const error = fetcher.data?.error ?? failure?.log ?? workerFailure?.message ?? notificationFailure?.message ?? null;
  return (
    <fetcher.Form method="post" action="/run">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value={artifact} />
      <InterviewField interviewNumber={interviewNumber} />
      <WorkerTask refusal={module.refusal} error={error}>
        <span role="status">
          <StateBadge state={state} />
        </span>
        <button
          className="button button--primary"
          type="submit"
          disabled={!isHydrated || isRunning || module.refusal !== null || fetcher.state !== 'idle'}
        >
          {t(state === 'absent' ? 'launchArtifact' : 'relaunchArtifact', {
            artifactLabel: t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' }),
          })}
        </button>
      </WorkerTask>
    </fetcher.Form>
  );
}

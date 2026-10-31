import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { isPending } from '#/actions/state.ts';
import type { IRefusal } from '#/web/failure.ts';

import { StateBadge } from './badge.tsx';
import type { IArtifactVersions } from './posting-detail.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';
import { WorkerTask } from './worker-task.tsx';

// The button of the module that produces an Artifact, beside its state. The worker runs the job in
// its own process (ADR-0003), so the Posting page reads the state again until the job is done, and
// says when no worker moves it.
export function ModuleLaunch({
  reference,
  artifact,
  state,
  failure,
  notificationFailure,
  module,
  workerFailure,
}: Readonly<
  Pick<IArtifactVersions, 'artifact' | 'state' | 'failure' | 'notificationFailure' | 'workerFailure' | 'module'> & {
    reference: string;
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

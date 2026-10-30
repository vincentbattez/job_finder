import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { StateBadge } from './badge.tsx';
import type { IArtifactVersions } from './posting-detail.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// The button of the module that produces an Artifact, beside its state. The worker runs the job in
// its own process (ADR-0003), so the Posting page reads the state again until the job is done.
export function ModuleLaunch({
  reference,
  artifact,
  state,
  module,
}: Readonly<Pick<IArtifactVersions, 'artifact' | 'state' | 'module'> & { reference: string }>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<{ error: string | null }>();
  const isHydrated = useIsHydrated();
  const isRunning = state === 'in_progress';
  useRevalidateWhile(isRunning);
  const error = fetcher.data?.error ?? null;
  return (
    <fetcher.Form method="post" action="/run" className="launch">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value={artifact} />
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
      {module.refusal !== null && <p className="launch__refusal">{module.refusal}</p>}
      {error !== null && <p role="alert">{error}</p>}
    </fetcher.Form>
  );
}

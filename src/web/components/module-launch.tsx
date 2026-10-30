import { useFetcher } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

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
  const { common } = useCatalogue();
  const fetcher = useFetcher<{ error: string | null }>();
  const isHydrated = useIsHydrated();
  const isRunning = state === 'in_progress';
  useRevalidateWhile(isRunning);
  const error = fetcher.data?.error ?? null;
  return (
    <fetcher.Form method="post" action="/run" className="module-launch">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value={artifact} />
      <span role="status">
        <StateBadge state={state} />
      </span>
      <button type="submit" disabled={!isHydrated || isRunning || module.refusal !== null || fetcher.state !== 'idle'}>
        {state === 'absent' ? 'Lancer' : 'Relancer'} la {common.artifactLabelByArtifact[artifact]}
      </button>
      {module.refusal !== null && <p className="module-launch__refusal">{module.refusal}</p>}
      {error !== null && <p role="alert">{error}</p>}
    </fetcher.Form>
  );
}

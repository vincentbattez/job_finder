import { useFetcher } from 'react-router';

import { EtatBadge } from './badge.tsx';
import { ARTEFACT_LABEL_BY_ARTEFACT, type IArtefactVersions } from './offre-fiche.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// The button of the module that produces an Artefact, beside its état. The worker runs the job in
// its own process (ADR-0003), so the fiche reads the état again until the job is done.
export function ModuleLaunch({
  reference,
  artefact,
  etat,
  module,
}: Readonly<Pick<IArtefactVersions, 'artefact' | 'etat' | 'module'> & { reference: string }>) {
  const fetcher = useFetcher<{ error: string | null }>();
  const isHydrated = useIsHydrated();
  const isRunning = etat === 'en_cours';
  useRevalidateWhile(isRunning);
  if (module === null) {
    return null;
  }
  const error = fetcher.data?.error ?? null;
  return (
    <fetcher.Form method="post" action="/run" className="module-launch">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value={artefact} />
      <span role="status">
        <EtatBadge etat={etat} />
      </span>
      <button type="submit" disabled={!isHydrated || isRunning || module.refusal !== null || fetcher.state !== 'idle'}>
        {etat === 'absent' ? 'Lancer' : 'Relancer'} la {ARTEFACT_LABEL_BY_ARTEFACT[artefact]}
      </button>
      {module.refusal !== null && <p className="module-launch__refusal">{module.refusal}</p>}
      {error !== null && <p role="alert">{error}</p>}
    </fetcher.Form>
  );
}

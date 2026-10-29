import { useEffect } from 'react';
import { useFetcher, useRevalidator } from 'react-router';

import { EtatBadge } from './badge.tsx';
import { ARTEFACT_LABEL_BY_ARTEFACT, type IArtefactVersions } from './offre-fiche.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

// How often the fiche reads the état again while its Artefact is en cours: a module runs for minutes
const POLL_INTERVAL_MS = 2000;

// The button of the module that produces an Artefact, beside its état. The worker runs the job in
// its own process (ADR-0003), so the fiche reads the état again until the job is done.
export function ModuleLaunch({
  reference,
  artefact,
  etat,
  module,
}: Readonly<Omit<IArtefactVersions, 'versionList'> & { reference: string }>) {
  const fetcher = useFetcher<{ error: string | null }>();
  const { revalidate } = useRevalidator();
  const isHydrated = useIsHydrated();
  const isRunning = etat === 'en_cours';
  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => void revalidate(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [isRunning, revalidate]);
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

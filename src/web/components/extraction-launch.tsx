import { useId } from 'react';
import { useFetcher } from 'react-router';

import { EtatBadge, type Etat } from './badge.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// The extraction of an imported Offre, which the worker runs: Claude reads the fields of its Fiche
// de poste. Its état, read again until the worker is done, and after a failure, why and a button to
// run it again.
export function ExtractionLaunch({ reference, etat, log }: Readonly<{ reference: string; etat: Etat; log: string }>) {
  const fetcher = useFetcher<{ error: string | null }>();
  const isHydrated = useIsHydrated();
  const labelId = useId();
  useRevalidateWhile(etat === 'en_cours');
  return (
    <fetcher.Form method="post" action="/run" className="module-launch" aria-labelledby={labelId}>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value="extraction" />
      <span id={labelId}>Champs relevés par Claude</span>
      <span role="status">
        <EtatBadge etat={etat} />
      </span>
      {etat === 'en_echec' && (
        <>
          <button type="submit" disabled={!isHydrated || fetcher.state !== 'idle'}>
            Relancer l’extraction
          </button>
          <p className="module-launch__refusal">{log}</p>
        </>
      )}
      {fetcher.data?.error != null && <p role="alert">{fetcher.data.error}</p>}
    </fetcher.Form>
  );
}

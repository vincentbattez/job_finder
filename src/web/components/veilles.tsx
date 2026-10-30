import { useId, useState } from 'react';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { ParametreField } from './parametre-field.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

type Veille = Awaited<ReturnType<Actions['listVeilles']>>[number];
type SourceModule = Awaited<ReturnType<Actions['listSources']>>[number];

// What /veille answers a save or a deletion: a message or a refusal, in the words of the action
interface IOutcome {
  message: string | null;
  error: string | null;
}

// A Veille, or a new one without veille: the Source it follows and the fields its descriptor
// describes (ADR-0010)
function VeilleForm({ veille, sourceList }: Readonly<{ veille: Veille | null; sourceList: SourceModule[] }>) {
  const fetcher = useFetcher<IOutcome>();
  const isHydrated = useIsHydrated();
  const [sourceId, setSourceId] = useState(veille?.source ?? sourceList[0]?.id ?? '');
  const source = sourceList.find(({ id }) => id === sourceId);
  // The saved Paramètres belong to the saved Source: another one starts blank
  const savedParametres = veille !== null && veille.source === sourceId ? veille.parametres : undefined;
  const isDisabled = !isHydrated || fetcher.state !== 'idle';
  return (
    <fetcher.Form method="post" action="/veille">
      <fieldset>
        <legend>{veille === null ? 'Nouvelle Veille' : `Veille ${veille.id}`}</legend>
        {veille !== null && <input type="hidden" name="veilleId" value={veille.id} />}
        <label className="settings__field">
          Source
          <select
            name="source"
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
            }}
          >
            {sourceList.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {/* Keyed by the Source, so that another one starts from its own saved values */}
        {source?.parametreList.map((parametre) => (
          <ParametreField
            key={`${sourceId}:${parametre.name}`}
            parametre={parametre}
            savedValue={savedParametres?.[parametre.name]}
            className="settings__field"
          />
        ))}
        <div className="settings__step">
          <button type="submit" name="intent" value="save" className="button--primary" disabled={isDisabled}>
            {veille === null ? 'Créer la Veille' : 'Enregistrer'}
          </button>
          {veille !== null && (
            <button type="submit" name="intent" value="delete" disabled={isDisabled} formNoValidate>
              Supprimer la Veille
            </button>
          )}
          {fetcher.state === 'idle' && fetcher.data?.error != null && <p role="alert">{fetcher.data.error}</p>}
          {fetcher.state === 'idle' && fetcher.data?.message != null && <p role="status">{fetcher.data.message}</p>}
        </div>
      </fieldset>
    </fetcher.Form>
  );
}

// The Veilles of the Candidate, each on its Source; a deleted Veille leaves its Offres behind
export function Veilles({ veilleList, sourceList }: Readonly<{ veilleList: Veille[]; sourceList: SourceModule[] }>) {
  const headingId = useId();
  return (
    <section className="settings" aria-labelledby={headingId}>
      <h2 id={headingId}>Veilles</h2>
      <p>
        Chaque Veille cherche en permanence les nouvelles Offres d’une Source. Une Veille créée ou modifiée importe
        d’abord les Offres déjà en ligne, sans rien lancer ; ensuite, chaque nouvelle Offre de sa Zone lance sa
        Recherche et vous est notifiée. Supprimer une Veille garde ses Offres.
      </p>
      {veilleList.map((veille) => (
        <VeilleForm key={veille.id} veille={veille} sourceList={sourceList} />
      ))}
      {/* Remounted once a Veille is created, so the form starts blank again */}
      <VeilleForm key={veilleList.map(({ id }) => id).join('/')} veille={null} sourceList={sourceList} />
    </section>
  );
}

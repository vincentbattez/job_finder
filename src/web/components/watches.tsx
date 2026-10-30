import { useId, useState } from 'react';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { ParameterField } from './parameter-field.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

type Watch = Awaited<ReturnType<Actions['listWatches']>>[number];
type SourceModule = Awaited<ReturnType<Actions['listSources']>>[number];

// What /watch answers a save or a deletion: a message or a refusal, in the words of the action
interface IOutcome {
  message: string | null;
  error: string | null;
}

// A Watch, or a new one without watch: the Source it follows and the fields its descriptor
// describes (ADR-0010)
function WatchForm({ watch, sourceList }: Readonly<{ watch: Watch | null; sourceList: SourceModule[] }>) {
  const fetcher = useFetcher<IOutcome>();
  const isHydrated = useIsHydrated();
  const [sourceId, setSourceId] = useState(watch?.source ?? sourceList[0]?.id ?? '');
  const source = sourceList.find(({ id }) => id === sourceId);
  // The saved Parameters belong to the saved Source: another one starts blank
  const savedParameters = watch !== null && watch.source === sourceId ? watch.parameters : undefined;
  const isDisabled = !isHydrated || fetcher.state !== 'idle';
  return (
    <fetcher.Form method="post" action="/watch">
      <fieldset>
        <legend>{watch === null ? 'Nouvelle Veille' : `Veille ${watch.id}`}</legend>
        {watch !== null && <input type="hidden" name="watchId" value={watch.id} />}
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
        {source?.parameterList.map((parameter) => (
          <ParameterField
            key={`${sourceId}:${parameter.name}`}
            parameter={parameter}
            savedValue={savedParameters?.[parameter.name]}
            className="settings__field"
          />
        ))}
        <div className="settings__step">
          <button type="submit" name="intent" value="save" className="button--primary" disabled={isDisabled}>
            {watch === null ? 'Créer la Veille' : 'Enregistrer'}
          </button>
          {watch !== null && (
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

// The Watches of the Candidate, each on its Source; a deleted Watch leaves its Offres behind
export function Watches({ watchList, sourceList }: Readonly<{ watchList: Watch[]; sourceList: SourceModule[] }>) {
  const headingId = useId();
  return (
    <section className="settings" aria-labelledby={headingId}>
      <h2 id={headingId}>Veilles</h2>
      <p>
        Chaque Veille cherche en permanence les nouvelles Offres d’une Source. Une Veille créée ou modifiée importe
        d’abord les Offres déjà en ligne, sans rien lancer ; ensuite, chaque nouvelle Offre de sa Zone lance sa
        Recherche et vous est notifiée. Supprimer une Veille garde ses Offres.
      </p>
      {watchList.map((watch) => (
        <WatchForm key={watch.id} watch={watch} sourceList={sourceList} />
      ))}
      {/* Remounted once a Watch is created, so the form starts blank again */}
      <WatchForm key={watchList.map(({ id }) => id).join('/')} watch={null} sourceList={sourceList} />
    </section>
  );
}

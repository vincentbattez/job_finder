import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { ParameterField } from './parameter-field.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

import './watches.css';

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
  const { t } = useTranslation('settings');
  const [sourceId, setSourceId] = useState(watch?.source ?? sourceList[0]?.id ?? '');
  const source = sourceList.find(({ id }) => id === sourceId);
  // The saved Parameters belong to the saved Source: another one starts blank
  const savedParameters = watch !== null && watch.source === sourceId ? watch.parameters : undefined;
  const isDisabled = !isHydrated || fetcher.state !== 'idle';
  return (
    <fetcher.Form method="post" action="/watch">
      <fieldset className="watches__watch">
        <legend>{watch === null ? t('watches.newWatch') : t('watches.watch', { watchId: watch.id })}</legend>
        {watch !== null && <input type="hidden" name="watchId" value={watch.id} />}
        <label className="field">
          {t('watches.source')}
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
          />
        ))}
        <div className="form-step">
          <button type="submit" name="intent" value="save" className="button button--primary" disabled={isDisabled}>
            {watch === null ? t('watches.create') : t('watches.save')}
          </button>
          {watch !== null && (
            <button className="button" type="submit" name="intent" value="delete" disabled={isDisabled} formNoValidate>
              {t('watches.delete')}
            </button>
          )}
          {fetcher.state === 'idle' && fetcher.data?.error != null && <p role="alert">{fetcher.data.error}</p>}
          {fetcher.state === 'idle' && fetcher.data?.message != null && <p role="status">{fetcher.data.message}</p>}
        </div>
      </fieldset>
    </fetcher.Form>
  );
}

// The Watches of the Candidate, each on its Source; a deleted Watch leaves its Postings behind
export function Watches({ watchList, sourceList }: Readonly<{ watchList: Watch[]; sourceList: SourceModule[] }>) {
  const headingId = useId();
  const { t } = useTranslation('settings');
  return (
    <section className="form-section" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('watches.heading')}</h2>
      <p>{t('watches.intro')}</p>
      {watchList.map((watch) => (
        <WatchForm key={watch.id} watch={watch} sourceList={sourceList} />
      ))}
      {/* Remounted once a Watch is created, so the form starts blank again */}
      <WatchForm key={watchList.map(({ id }) => id).join('/')} watch={null} sourceList={sourceList} />
    </section>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';

import { ParameterField } from './parameter-field.tsx';
import { SettingsStep } from './settings-panel.tsx';

import './watches.css';

export type Watch = Awaited<ReturnType<Actions['listWatches']>>[number];
export type SourceModule = Awaited<ReturnType<Actions['listSources']>>[number];

// A Watch, or a new one without watch, inside the form of its Container: the Source it follows and
// the fields its descriptor describes (ADR-0010), with what its last save or deletion answered
export function WatchFields({
  watch,
  sourceList,
  isDisabled,
  error,
  message,
}: Readonly<{
  watch: Watch | null;
  sourceList: SourceModule[];
  isDisabled: boolean;
  error: string | null;
  message: string | null;
}>) {
  const { t } = useTranslation('settings');
  const [sourceId, setSourceId] = useState(watch?.source ?? sourceList[0]?.id ?? '');
  const source = sourceList.find(({ id }) => id === sourceId);
  // The saved Parameters belong to the saved Source: another one starts blank
  const savedParameters = watch !== null && watch.source === sourceId ? watch.parameters : undefined;
  return (
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
      <SettingsStep>
        <button type="submit" name="intent" value="save" className="button button--primary" disabled={isDisabled}>
          {watch === null ? t('watches.create') : t('watches.save')}
        </button>
        {watch !== null && (
          <button className="button" type="submit" name="intent" value="delete" disabled={isDisabled} formNoValidate>
            {t('watches.delete')}
          </button>
        )}
        {error !== null && <p role="alert">{error}</p>}
        {message !== null && <p role="status">{message}</p>}
      </SettingsStep>
    </fieldset>
  );
}

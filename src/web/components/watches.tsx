import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { Label } from '#/web/components/ui/label.tsx';
import { NativeSelect } from '#/web/components/ui/native-select.tsx';

import { ParameterField } from './parameter-field.tsx';

export type Watch = Awaited<ReturnType<Actions['listWatches']>>[number];
export type SourceModule = Awaited<ReturnType<Actions['listSources']>>[number];

// The anchor of the Near Misses, which the Detection's verdict links to (spec #125 « Profile, Watches, Settings »)
export const NEAR_MISSES_ANCHOR = 'near-misses';

// The fields of a Watch, or of a new one: the Source it follows, then the Parameters its descriptor
// describes (ADR-0010). Another Source starts from blank fields, its own saved values once back to it.
export function WatchFields({ watch, sourceList }: Readonly<{ watch: Watch | null; sourceList: SourceModule[] }>) {
  const { t } = useTranslation('settings');
  const sourceFieldId = useId();
  const [sourceId, setSourceId] = useState(watch?.source ?? sourceList[0]?.id ?? '');
  const source = sourceList.find(({ id }) => id === sourceId);
  const savedParameters = watch !== null && watch.source === sourceId ? watch.parameters : undefined;
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={sourceFieldId}>{t('watches.source')}</Label>
        <NativeSelect
          id={sourceFieldId}
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
        </NativeSelect>
      </div>
      {/* Keyed by the Source, so that another one starts from its own saved values */}
      {source?.parameterList.map((parameter) => (
        <ParameterField
          key={`${sourceId}:${parameter.name}`}
          parameter={parameter}
          savedValue={savedParameters?.[parameter.name]}
        />
      ))}
    </div>
  );
}

// What the card of a Watch says under its name: its Source, when a Detection last went through it,
// and how many titles it set aside by a narrow margin, linked to them
export function WatchSummary({ watch, sourceName }: Readonly<{ watch: Watch; sourceName: string }>) {
  const { t } = useTranslation('settings');
  const { detectedAt, nearMissList } = watch;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1">
      <span>{sourceName}</span>
      <span aria-hidden>·</span>
      <span>
        {detectedAt === null ? t('watches.firstLaunch') : t('watches.lastDetection', { date: new Date(detectedAt) })}
      </span>
      {nearMissList.length > 0 && (
        <>
          <span aria-hidden>·</span>
          <a href={`#${NEAR_MISSES_ANCHOR}`} className="underline underline-offset-4 hover:text-foreground">
            {t('watches.nearMissCount', { count: nearMissList.length })}
          </a>
        </>
      )}
    </span>
  );
}

// The titles the last Detection of each Watch set aside by a narrow margin, Watch by Watch, so the
// Candidate can widen the one whose title is too narrow (GLOSSARY « Near Miss »)
export function NearMisses({ watchList }: Readonly<{ watchList: Watch[] }>) {
  const { t } = useTranslation('settings');
  const nearMissWatchList = watchList.filter(({ nearMissList }) => nearMissList.length > 0);
  if (nearMissWatchList.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('watches.nearMisses.none')}</p>;
  }
  return (
    <div className="grid gap-6">
      {nearMissWatchList.map(({ id, label, nearMissList }) => (
        <NearMissGroup key={id} label={label} nearMissList={nearMissList} />
      ))}
    </div>
  );
}

function NearMissGroup({ label, nearMissList }: Readonly<{ label: string; nearMissList: Watch['nearMissList'] }>) {
  return (
    <div className="grid gap-2">
      <h3 className="max-w-none text-sm font-semibold">{label}</h3>
      <ul className="divide-y rounded-lg border">
        {nearMissList.map(({ reference, title }) => (
          <li key={reference} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
            <span className="min-w-0 text-sm">{title}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{reference}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

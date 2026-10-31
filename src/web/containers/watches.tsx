import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { SettingsPanel } from '#/web/components/settings-panel.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import { WatchFields, type SourceModule, type Watch } from '#/web/components/watches.tsx';

// What /watch answers a save or a deletion: a message or a refusal, in the words of the action
interface IOutcome {
  message: string | null;
  error: string | null;
}

// A Watch, or a new one without watch, saved or deleted through /watch
function WatchForm({ watch, sourceList }: Readonly<{ watch: Watch | null; sourceList: SourceModule[] }>) {
  const fetcher = useFetcher<IOutcome>();
  const isHydrated = useIsHydrated();
  const isIdle = fetcher.state === 'idle';
  return (
    <fetcher.Form method="post" action="/watch">
      <WatchFields
        watch={watch}
        sourceList={sourceList}
        isDisabled={!isHydrated || !isIdle}
        error={isIdle ? (fetcher.data?.error ?? null) : null}
        message={isIdle ? (fetcher.data?.message ?? null) : null}
      />
    </fetcher.Form>
  );
}

// The Watches of the Candidate, each on its Source; a deleted Watch leaves its Postings behind
export function Watches({ watchList, sourceList }: Readonly<{ watchList: Watch[]; sourceList: SourceModule[] }>) {
  const { t } = useTranslation('settings');
  return (
    <SettingsPanel heading={t('watches.heading')}>
      <p>{t('watches.intro')}</p>
      {watchList.map((watch) => (
        <WatchForm key={watch.id} watch={watch} sourceList={sourceList} />
      ))}
      {/* Remounted once a Watch is created, so the form starts blank again */}
      <WatchForm key={watchList.map(({ id }) => id).join('/')} watch={null} sourceList={sourceList} />
    </SettingsPanel>
  );
}

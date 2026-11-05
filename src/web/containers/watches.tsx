import { PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { SettingsSection } from '#/web/components/settings-section.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/web/components/ui/alert-dialog.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import {
  NEAR_MISSES_ANCHOR,
  NearMisses,
  WatchFields,
  WatchSummary,
  type SourceModule,
  type Watch,
} from '#/web/components/watches.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';
import { useSettled } from './use-settled.ts';

// A Watch saved through the Watches page, its deletion asked of the page, which outlives its card
function WatchCard({
  watch,
  sourceList,
  onDelete,
}: Readonly<{ watch: Watch; sourceList: SourceModule[]; onDelete: () => void }>) {
  const { t } = useTranslation('settings');
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('watches.saved'));
  const sourceName = sourceList.find(({ id }) => id === watch.source)?.name ?? watch.source;
  return (
    <SettingsSection heading={watch.label} description={<WatchSummary watch={watch} sourceName={sourceName} />}>
      <fetcher.Form method="post" action="/watches" className="grid gap-6">
        <input type="hidden" name="intent" value="save" />
        <input type="hidden" name="watchId" value={watch.id} />
        <WatchFields watch={watch} sourceList={sourceList} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            aria-label={t('watches.deleteOf', { label: watch.label })}
            onClick={onDelete}
          >
            <Trash2Icon />
            {t('watches.delete')}
          </Button>
          <Button type="submit" isPending={fetcher.state !== 'idle'}>
            <SaveIcon />
            {t('watches.save')}
          </Button>
        </div>
      </fetcher.Form>
    </SettingsSection>
  );
}

// A new Watch; once created, the form starts blank again, a refusal keeping what was typed
function WatchCreation({ sourceList }: Readonly<{ sourceList: SourceModule[] }>) {
  const { t } = useTranslation('settings');
  const formReference = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('watches.created'));
  useSettled(fetcher, (answer) => {
    if (typeof answer?.error !== 'string') {
      formReference.current?.reset();
    }
  });
  return (
    <SettingsSection heading={t('watches.newWatch')} description={t('watches.newWatchDescription')}>
      <fetcher.Form ref={formReference} method="post" action="/watches" className="grid gap-6">
        <input type="hidden" name="intent" value="save" />
        <WatchFields watch={null} sourceList={sourceList} />
        <div className="flex justify-end">
          <Button type="submit" isPending={fetcher.state !== 'idle'}>
            <PlusIcon />
            {t('watches.create')}
          </Button>
        </div>
      </fetcher.Form>
    </SettingsSection>
  );
}

// The Watches of the Candidate, each a plain form, then a new one, then the Near Misses of their last
// Detection under the anchor the Detection's verdict links to. Deleting one goes through an AlertDialog;
// its Postings stay with the Candidate.
export function Watches({ watchList, sourceList }: Readonly<{ watchList: Watch[]; sourceList: SourceModule[] }>) {
  const { t } = useTranslation('settings');
  const [deletion, setDeletion] = useState<{ isOpen: boolean; watch: Watch | null }>({ isOpen: false, watch: null });
  const removalFetcher = useFetcher<IRefusal>();
  useFeedback(removalFetcher, () => t('watches.deleted'));
  const label = deletion.watch?.label ?? '';
  return (
    <>
      {watchList.length === 0 && <p className="text-sm text-muted-foreground">{t('watches.noWatch')}</p>}
      {watchList.map((watch) => (
        <WatchCard
          key={watch.id}
          watch={watch}
          sourceList={sourceList}
          onDelete={() => {
            setDeletion({ isOpen: true, watch });
          }}
        />
      ))}
      <WatchCreation sourceList={sourceList} />
      <SettingsSection
        heading={t('watches.nearMisses.heading')}
        description={t('watches.nearMisses.description')}
        anchor={NEAR_MISSES_ANCHOR}
      >
        <NearMisses watchList={watchList} />
      </SettingsSection>
      <AlertDialog
        open={deletion.isOpen}
        onOpenChange={(isOpen) => {
          setDeletion({ ...deletion, isOpen });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('watches.deleteTitle', { label })}</AlertDialogTitle>
            <AlertDialogDescription>{t('watches.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('watches.keep')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void removalFetcher.submit(
                  { intent: 'delete', watchId: deletion.watch?.id ?? '' },
                  { method: 'post', action: '/watches', preventScrollReset: true },
                );
              }}
            >
              {t('watches.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

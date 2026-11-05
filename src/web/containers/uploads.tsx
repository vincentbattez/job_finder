import { RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { StateBadge, type State } from '#/web/components/badge.tsx';
import { DateText } from '#/web/components/date.tsx';
import { DropZone } from '#/web/components/drop-zone.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import type { IProfileDeletion } from './profile-deletion.tsx';
import { useFeedback } from './use-feedback.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

interface IConversion {
  state: State;
  log: string;
}

// The worker converts an Upload in its own process (ADR-0003); its file then shows among those of the
// Profile. A failed conversion says why, and runs again on demand.
function UploadConversion({ fileName, conversion }: Readonly<{ fileName: string; conversion: IConversion }>) {
  const fetcher = useFetcher<IRefusal>();
  const isHydrated = useIsHydrated();
  const labelId = useId();
  const { state, log } = conversion;
  const { t } = useTranslation('settings');
  useFeedback(fetcher, () => t('uploads.conversionQueued', { fileName }));
  return (
    <fetcher.Form
      method="post"
      action="/profile"
      preventScrollReset
      aria-labelledby={labelId}
      className="grid gap-2 pt-2"
    >
      <input type="hidden" name="fileName" value={fileName} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span id={labelId} className="text-muted-foreground">
          {t('uploads.conversion')}
          <span className="sr-only">{t('uploads.ofFile', { fileName })}</span>
        </span>
        <span role="status">
          <StateBadge state={state} />
        </span>
        {(state === 'absent' || state === 'failed') && (
          <Button
            type="submit"
            name="intent"
            value="convertUpload"
            variant="outline"
            size="sm"
            disabled={!isHydrated}
            isPending={fetcher.state !== 'idle'}
          >
            <RefreshCwIcon />
            {state === 'absent' ? t('uploads.convert') : t('uploads.convertAgain')}
            <span className="sr-only">{t('uploads.ofFile', { fileName })}</span>
          </Button>
        )}
      </div>
      {state === 'failed' && <p className="text-sm text-destructive">{log}</p>}
    </fetcher.Form>
  );
}

// The PDFs the Candidate dropped, which the worker converts into the Profile, sent to /profile
export function Uploads({
  uploadList,
  deletion,
}: Readonly<{
  uploadList: { fileName: string; savedAt: Date; conversion: IConversion }[];
  deletion: IProfileDeletion;
}>) {
  const { t } = useTranslation('settings');
  const isHydrated = useIsHydrated();
  const fetcher = useFetcher<IRefusal>();
  const sentFileName = useRef('');
  useFeedback(fetcher, () => t('uploads.dropped', { fileName: sentFileName.current }));
  useRevalidateWhile(uploadList.some(({ conversion }) => conversion.state === 'in_progress'));

  // Multipart, so the PDF reaches the action byte for byte, unlike the text of a Job Description
  async function saveUpload(file: File): Promise<void> {
    sentFileName.current = file.name;
    const formData = new FormData();
    formData.set('intent', 'upload');
    formData.set('upload', file);
    await fetcher.submit(formData, { method: 'post', action: '/profile', encType: 'multipart/form-data' });
  }

  return (
    <div className="grid gap-4">
      {uploadList.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('uploads.noUpload')}</p>
      ) : (
        <ul className="grid divide-y">
          {uploadList.map(({ fileName, savedAt, conversion }) => (
            <li key={fileName} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-full truncate font-mono text-sm sm:w-auto sm:min-w-0 sm:flex-1">{fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {t('uploads.savedOn')} <DateText date={savedAt} />
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={!isHydrated}
                  isPending={deletion.pendingFileName === fileName}
                  aria-label={t('profileFile.deleteOf', { fileName })}
                  onClick={() => {
                    deletion.ask('deleteUpload', fileName);
                  }}
                >
                  <Trash2Icon />
                  {t('profileFile.delete')}
                </Button>
              </div>
              <UploadConversion fileName={fileName} conversion={conversion} />
            </li>
          ))}
        </ul>
      )}
      <DropZone
        accept=".pdf,application/pdf"
        label={t('uploads.drop')}
        isBusy={fetcher.state !== 'idle'}
        onFile={(file) => void saveUpload(file)}
      />
    </div>
  );
}

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { StateBadge, type State } from '#/web/components/badge.tsx';
import { Uploads as UploadsView } from '#/web/components/uploads.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import { WorkerTask } from '#/web/components/worker-task.tsx';

import { useRevalidateWhile } from './use-revalidate-while.ts';

// What the Profile action answers a fetcher: a refusal, in the words of the action, or none
interface IUploadRefusal {
  refusal: { message: string } | null;
}

interface IConversion {
  state: State;
  log: string;
}

// The worker converts an Upload in its own process (ADR-0003); its file then shows among those of the
// Profile. A failed conversion says why, and runs again on demand.
function UploadConversion({ fileName, conversion }: Readonly<{ fileName: string; conversion: IConversion }>) {
  const fetcher = useFetcher<IUploadRefusal>();
  const isHydrated = useIsHydrated();
  const labelId = useId();
  const { state, log } = conversion;
  const { t } = useTranslation('settings');
  return (
    <fetcher.Form method="post" action="/profile" aria-labelledby={labelId}>
      <input type="hidden" name="fileName" value={fileName} />
      <WorkerTask
        refusal={state === 'failed' ? log : null}
        error={fetcher.state === 'idle' ? fetcher.data?.refusal?.message : null}
      >
        <span id={labelId}>
          {t('uploads.conversion')}
          <span className="visually-hidden">{t('uploads.ofFile', { fileName })}</span>
        </span>
        <span role="status">
          <StateBadge state={state} />
        </span>
        {(state === 'absent' || state === 'failed') && (
          <button
            className="button button--primary"
            type="submit"
            name="intent"
            value="convertUpload"
            disabled={!isHydrated || fetcher.state !== 'idle'}
          >
            {state === 'absent' ? t('uploads.convert') : t('uploads.convertAgain')}
            <span className="visually-hidden">{t('uploads.ofFile', { fileName })}</span>
          </button>
        )}
      </WorkerTask>
    </fetcher.Form>
  );
}

// The PDFs the Candidate dropped, sent to /profile, and deleted there
export function Uploads({
  uploadList,
}: Readonly<{ uploadList: { fileName: string; savedAt: Date; conversion: IConversion }[] }>) {
  const fetcher = useFetcher<IUploadRefusal>();
  useRevalidateWhile(uploadList.some(({ conversion }) => conversion.state === 'in_progress'));

  // Multipart, so the PDF reaches the action byte for byte, unlike the text of a Job Description
  async function saveUpload(file: File): Promise<void> {
    const formData = new FormData();
    formData.set('intent', 'upload');
    formData.set('upload', file);
    await fetcher.submit(formData, { method: 'post', action: '/profile', encType: 'multipart/form-data' });
  }

  return (
    <UploadsView
      uploadList={uploadList}
      isSending={fetcher.state !== 'idle'}
      error={fetcher.data?.refusal?.message}
      onFile={(file) => void saveUpload(file)}
      renderForm={(fieldList) => (
        <fetcher.Form method="post" action="/profile">
          {fieldList}
        </fetcher.Form>
      )}
      renderConversion={({ fileName, conversion }) => <UploadConversion fileName={fileName} conversion={conversion} />}
    />
  );
}

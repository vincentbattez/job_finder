import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { StateBadge, type State } from './badge.tsx';
import { DateText } from './date.tsx';
import { Deletion } from './deletion.tsx';
import { DropZone } from './drop-zone.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';
import { WorkerTask } from './worker-task.tsx';

import './uploads.css';

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
    <fetcher.Form method="post" action="/profile" className="uploads__conversion" aria-labelledby={labelId}>
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

// The PDFs the Candidate dropped, kept as is; the action says why a file is refused
export function Uploads({
  uploadList,
}: Readonly<{ uploadList: { fileName: string; savedAt: Date; conversion: IConversion }[] }>) {
  const headingId = useId();
  const fetcher = useFetcher<IUploadRefusal>();
  const isSending = fetcher.state !== 'idle';
  const { t } = useTranslation('settings');
  useRevalidateWhile(uploadList.some(({ conversion }) => conversion.state === 'in_progress'));

  // Multipart, so the PDF reaches the action byte for byte, unlike the text of a Job Description
  async function saveUpload(file: File): Promise<void> {
    const formData = new FormData();
    formData.set('intent', 'upload');
    formData.set('upload', file);
    await fetcher.submit(formData, { method: 'post', action: '/profile', encType: 'multipart/form-data' });
  }

  return (
    <section className="uploads" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('uploads.heading')}</h2>
      {uploadList.length === 0 ? (
        <p className="uploads__empty">{t('uploads.noUpload')}</p>
      ) : (
        <ul className="uploads__list">
          {uploadList.map(({ fileName, savedAt, conversion }) => (
            <li key={fileName} className="uploads__item">
              <span className="uploads__file-name">{fileName}</span>
              <span className="uploads__date">
                {t('uploads.savedOn')} <DateText date={savedAt} />
              </span>
              <div className="uploads__delete">
                <Deletion
                  summary={
                    // The name is read aloud only: the row already shows it
                    <>
                      {t('uploads.delete')}
                      <span className="visually-hidden"> {fileName}</span>…
                    </>
                  }
                >
                  <fetcher.Form method="post" action="/profile">
                    <input type="hidden" name="fileName" value={fileName} />
                    <button type="submit" name="intent" value="deleteUpload" className="button button--danger">
                      {t('uploads.deleteForGood')}
                      <span className="visually-hidden"> {fileName}</span>
                    </button>
                  </fetcher.Form>
                </Deletion>
              </div>
              <UploadConversion fileName={fileName} conversion={conversion} />
            </li>
          ))}
        </ul>
      )}
      <DropZone
        intro={t('uploads.dropIntro')}
        accept=".pdf,application/pdf"
        label={t('uploads.drop')}
        isBusy={isSending}
        onFile={(file) => void saveUpload(file)}
        error={isSending ? null : fetcher.data?.refusal?.message}
      />
    </section>
  );
}

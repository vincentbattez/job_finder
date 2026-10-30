import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { StateBadge, type State } from './badge.tsx';
import { DateText } from './date.tsx';
import { DropZone } from './drop-zone.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
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
    <fetcher.Form
      method="post"
      action="/profile"
      className="module-launch uploads__conversion"
      aria-labelledby={labelId}
    >
      <input type="hidden" name="fileName" value={fileName} />
      <span id={labelId}>
        {t('uploads.conversion')}
        <span className="visually-hidden">{t('uploads.ofFile', { fileName })}</span>
      </span>
      <span role="status">
        <StateBadge state={state} />
      </span>
      {(state === 'absent' || state === 'failed') && (
        <button type="submit" name="intent" value="convertUpload" disabled={!isHydrated || fetcher.state !== 'idle'}>
          {state === 'absent' ? t('uploads.convert') : t('uploads.convertAgain')}
          <span className="visually-hidden">{t('uploads.ofFile', { fileName })}</span>
        </button>
      )}
      {state === 'failed' && <p className="module-launch__refusal">{log}</p>}
      {fetcher.state === 'idle' && fetcher.data?.refusal != null && <p role="alert">{fetcher.data.refusal.message}</p>}
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
              <span className="reference">{fileName}</span>
              <span className="uploads__date">
                {t('uploads.savedOn')} <DateText date={savedAt} />
              </span>
              {/* Folded, so a deletion always takes a second, deliberate click */}
              <details className="profile-file__delete">
                {/* The name is read aloud only: the row already shows it */}
                <summary>
                  {t('uploads.delete')}
                  <span className="visually-hidden"> {fileName}</span>…
                </summary>
                <fetcher.Form method="post" action="/profile" className="edition">
                  <input type="hidden" name="fileName" value={fileName} />
                  <button type="submit" name="intent" value="deleteUpload" className="button--danger">
                    {t('uploads.deleteForGood')}
                    <span className="visually-hidden"> {fileName}</span>
                  </button>
                </fetcher.Form>
              </details>
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
      >
        {!isSending && fetcher.data?.refusal != null && (
          <p role="alert" className="drop-zone__error">
            {fetcher.data.refusal.message}
          </p>
        )}
      </DropZone>
    </section>
  );
}

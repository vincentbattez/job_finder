import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DateText } from './date.tsx';
import { Deletion } from './deletion.tsx';
import { DropZone } from './drop-zone.tsx';

import './uploads.css';

interface IUpload {
  fileName: string;
  savedAt: Date;
}

// The PDFs the Candidate dropped, kept as is. Its Container hands in the form that deletes one and
// the conversion of each, and receives the file dropped; the action says why a file is refused.
export function Uploads<TUpload extends IUpload>({
  uploadList,
  isSending,
  error,
  onFile,
  renderForm,
  renderConversion,
}: Readonly<{
  uploadList: TUpload[];
  isSending: boolean;
  error: string | null | undefined;
  onFile: (file: File) => void;
  renderForm: (fieldList: ReactNode) => ReactNode;
  renderConversion: (upload: TUpload) => ReactNode;
}>) {
  const headingId = useId();
  const { t } = useTranslation('settings');
  return (
    <section className="uploads" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('uploads.heading')}</h2>
      {uploadList.length === 0 ? (
        <p className="uploads__empty">{t('uploads.noUpload')}</p>
      ) : (
        <ul className="uploads__list">
          {uploadList.map((upload) => (
            <li key={upload.fileName} className="uploads__item">
              <span className="uploads__file-name">{upload.fileName}</span>
              <span className="uploads__date">
                {t('uploads.savedOn')} <DateText date={upload.savedAt} />
              </span>
              <div className="uploads__delete">
                <Deletion
                  summary={
                    // The name is read aloud only: the row already shows it
                    <>
                      {t('uploads.delete')}
                      <span className="visually-hidden"> {upload.fileName}</span>…
                    </>
                  }
                >
                  {renderForm(
                    <>
                      <input type="hidden" name="fileName" value={upload.fileName} />
                      <button type="submit" name="intent" value="deleteUpload" className="button button--danger">
                        {t('uploads.deleteForGood')}
                        <span className="visually-hidden"> {upload.fileName}</span>
                      </button>
                    </>,
                  )}
                </Deletion>
              </div>
              {/* Its conversion on a line of its own */}
              <div className="uploads__conversion">{renderConversion(upload)}</div>
            </li>
          ))}
        </ul>
      )}
      <DropZone
        intro={t('uploads.dropIntro')}
        accept=".pdf,application/pdf"
        label={t('uploads.drop')}
        isBusy={isSending}
        onFile={onFile}
        error={isSending ? null : error}
      />
    </section>
  );
}

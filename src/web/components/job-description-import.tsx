import { useTranslation } from 'react-i18next';
import { Link, useFetcher } from 'react-router';

import { DropZone } from './drop-zone.tsx';

import './job-description-import.css';

// The shape of the import action: the job of the extraction, with its Posting
interface IImport {
  job: { posting: { reference: string; title: string } } | null;
  error: string | null;
}

// The same action as jf import; the Posting is named after its file until the worker reads its fields
export function JobDescriptionImport() {
  const fetcher = useFetcher<IImport>();
  const isImporting = fetcher.state !== 'idle';
  const { t } = useTranslation('posting');

  async function importFile(file: File): Promise<void> {
    await fetcher.submit({ fileName: file.name, markdown: await file.text() }, { method: 'post', action: '/import' });
  }

  return (
    <DropZone
      intro={t('importIntro')}
      accept=".md,.markdown,text/markdown"
      label={t('importLabel')}
      isBusy={isImporting}
      onFile={(file) => void importFile(file)}
    >
      {!isImporting && fetcher.data?.job != null && (
        <p>
          {t('importedPosting')}{' '}
          <Link to={`/postings/${fetcher.data.job.posting.reference}`}>{fetcher.data.job.posting.title}</Link>.{' '}
          {t('importedPostingNext')}
        </p>
      )}
      {!isImporting && fetcher.data?.error != null && (
        <p className="job-description-import__error">{fetcher.data.error}</p>
      )}
    </DropZone>
  );
}

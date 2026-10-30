import { Link, useFetcher } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

import { DropZone } from './drop-zone.tsx';

// The shape of the import action: the job of the extraction, with its Posting
interface IImport {
  job: { posting: { reference: string; title: string } } | null;
  error: string | null;
}

// The same action as jf import; the Posting is named after its file until the worker reads its fields
export function JobDescriptionImport() {
  const fetcher = useFetcher<IImport>();
  const isImporting = fetcher.state !== 'idle';
  const { posting: copy } = useCatalogue();

  async function importFile(file: File): Promise<void> {
    await fetcher.submit({ fileName: file.name, markdown: await file.text() }, { method: 'post', action: '/import' });
  }

  return (
    <DropZone
      intro={copy.importIntro}
      accept=".md,.markdown,text/markdown"
      label={copy.importLabel}
      isBusy={isImporting}
      onFile={(file) => void importFile(file)}
    >
      {!isImporting && fetcher.data?.job != null && (
        <p>
          {copy.importedPosting}{' '}
          <Link to={`/postings/${fetcher.data.job.posting.reference}`}>{fetcher.data.job.posting.title}</Link>.{' '}
          {copy.importedPostingNext}
        </p>
      )}
      {!isImporting && fetcher.data?.error != null && <p className="drop-zone__error">{fetcher.data.error}</p>}
    </DropZone>
  );
}

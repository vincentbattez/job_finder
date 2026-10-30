import { Link, useFetcher } from 'react-router';

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

  async function importFile(file: File): Promise<void> {
    await fetcher.submit({ fileName: file.name, markdown: await file.text() }, { method: 'post', action: '/import' });
  }

  return (
    <DropZone
      intro="Glissez ici une Fiche de poste en Markdown trouvée ailleurs : elle devient une de vos Offres."
      accept=".md,.markdown,text/markdown"
      label="Importer une Fiche de poste"
      isBusy={isImporting}
      onFile={(file) => void importFile(file)}
    >
      {!isImporting && fetcher.data?.job != null && (
        <p>
          Offre importée :{' '}
          <Link to={`/postings/${fetcher.data.job.posting.reference}`}>{fetcher.data.job.posting.title}</Link>. Le
          worker en relève les champs avec Claude, puis lance sa Recherche.
        </p>
      )}
      {!isImporting && fetcher.data?.error != null && <p className="drop-zone__error">{fetcher.data.error}</p>}
    </DropZone>
  );
}

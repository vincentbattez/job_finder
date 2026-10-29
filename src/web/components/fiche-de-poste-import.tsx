import { useState } from 'react';
import { Link, useFetcher } from 'react-router';

import { useIsHydrated } from './use-is-hydrated.ts';

// The shape of the import action: the job of the extraction, with its Offre
interface IImport {
  job: { offre: { reference: string; title: string } } | null;
  error: string | null;
}

// The same action as jf import; the Offre is named after its file until the worker reads its fields
export function FicheDePosteImport() {
  const fetcher = useFetcher<IImport>();
  const isHydrated = useIsHydrated();
  const [isDragOver, setIsDragOver] = useState(false);
  const isImporting = fetcher.state !== 'idle';

  async function importFile(file: File | undefined): Promise<void> {
    if (file === undefined || isImporting) {
      return;
    }
    await fetcher.submit({ fileName: file.name, markdown: await file.text() }, { method: 'post', action: '/import' });
  }

  return (
    <div
      className="fiche-de-poste-import"
      data-drag-over={isDragOver}
      onDragOver={(event) => {
        // Lets the file drop here, instead of the browser opening it
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        void importFile(event.dataTransfer.files[0]);
      }}
    >
      <p>Glissez ici une Fiche de poste en Markdown trouvée ailleurs : elle devient une de vos Offres.</p>
      <label className="fiche-de-poste-import__choose" data-disabled={!isHydrated || isImporting}>
        Importer une Fiche de poste
        <input
          type="file"
          accept=".md,.markdown,text/markdown"
          className="visually-hidden"
          disabled={!isHydrated || isImporting}
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <div aria-live="polite">
        {!isImporting && fetcher.data?.job != null && (
          <p>
            Offre importée :{' '}
            <Link to={`/offres/${fetcher.data.job.offre.reference}`}>{fetcher.data.job.offre.title}</Link>. Le worker en
            relève les champs avec Claude, puis lance sa Recherche.
          </p>
        )}
        {!isImporting && fetcher.data?.error != null && (
          <p className="fiche-de-poste-import__error">{fetcher.data.error}</p>
        )}
      </div>
    </div>
  );
}

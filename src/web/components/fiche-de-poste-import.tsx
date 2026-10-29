import { useState } from 'react';
import { Link, useFetcher } from 'react-router';

import { useIsHydrated } from './use-is-hydrated.ts';

// The shape of the import action
interface IImport {
  offre: { reference: string; title: string } | null;
  error: string | null;
}

// Imports a Fiche de poste in Markdown found elsewhere, dropped here or chosen from the disk: the
// same action as jf import. The list below reloads with the new Offre.
export function FicheDePosteImport() {
  const fetcher = useFetcher<IImport>();
  const isHydrated = useIsHydrated();
  const [isDragOver, setIsDragOver] = useState(false);
  const isImporting = fetcher.state !== 'idle';

  async function importFile(file: File | undefined): Promise<void> {
    if (file === undefined || isImporting) {
      return;
    }
    await fetcher.submit({ markdown: await file.text() }, { method: 'post', action: '/import' });
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
      <p>
        Glissez ici une Fiche de poste en Markdown trouvée ailleurs : Claude en relève les champs, puis sa Recherche se
        lance.
      </p>
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
        {isImporting && <p>Claude relève les champs de la Fiche de poste…</p>}
        {!isImporting && fetcher.data?.offre != null && (
          <p>
            Offre importée : <Link to={`/offres/${fetcher.data.offre.reference}`}>{fetcher.data.offre.title}</Link>
          </p>
        )}
        {!isImporting && fetcher.data?.error != null && (
          <p className="fiche-de-poste-import__error">{fetcher.data.error}</p>
        )}
      </div>
    </div>
  );
}

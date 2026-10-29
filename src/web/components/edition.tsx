import { useState } from 'react';
import { Form } from 'react-router';

import type { Statut } from './badge.tsx';
import { CopyMarkdown } from './copy-command.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';

// What the Candidat changes from the fiche of an Offre. Each form posts to a route that relays to
// an action, then comes back to the fiche where it was (ADR-0003).

interface IArtefactDocument {
  reference: string;
  artefact: string;
  fileName: string;
  markdown: string;
  // Given by the action: a file of the Version retenue, except a Brouillon or a frozen Lettre
  isModifiable: boolean;
}

// A file of a Version: the editor when the Candidat may correct it, saved in place in the Version
// retenue, else the text as written. Either copies as Markdown, the way it goes into a mail.
export function ArtefactDocument({
  reference,
  artefact,
  fileName,
  markdown,
  isModifiable,
}: Readonly<IArtefactDocument>) {
  const [draft, setDraft] = useState(markdown);
  return (
    <figure className="document">
      <figcaption className="reference">{fileName}</figcaption>
      {isModifiable ? (
        <Form method="post" action={`/offres/${reference}/${artefact}/document`} preventScrollReset>
          <input type="hidden" name="fileName" value={fileName} />
          <MarkdownEditor label="Markdown" name="markdown" defaultValue={markdown} onChange={setDraft} />
          <div className="edition">
            <button type="submit" className="button--primary">
              Enregistrer
            </button>
            <CopyMarkdown markdown={draft} />
            {draft !== markdown && <p role="status">Modifications non enregistrées</p>}
          </div>
        </Form>
      ) : (
        <>
          <Markdown markdown={markdown} />
          <div className="edition">
            <CopyMarkdown markdown={markdown} />
          </div>
        </>
      )}
    </figure>
  );
}

export function RetenirButton({
  reference,
  artefact,
  number,
}: Readonly<{ reference: string; artefact: string; number: number }>) {
  return (
    <Form method="post" action={`/offres/${reference}/${artefact}/retenue`} preventScrollReset className="edition">
      <input type="hidden" name="number" value={number} />
      <button type="submit">Retenir cette Version</button>
    </Form>
  );
}

// Postulée is final and freezes the Lettre retenue, the one sent: no button is left then
export function StatutButtons({ reference, status }: Readonly<{ reference: string; status: Statut }>) {
  if (status === 'postulee') {
    return null;
  }
  return (
    <Form method="post" action={`/offres/${reference}/statut`} preventScrollReset className="edition">
      <button type="submit" name="status" value="postulee" className="button--primary">
        Marquer comme Postulée
      </button>
      {status === 'a_traiter' && (
        <button type="submit" name="status" value="archivee">
          Archiver
        </button>
      )}
      <p>Une fois Postulée, la Lettre retenue ne change plus : c’est celle envoyée.</p>
    </Form>
  );
}

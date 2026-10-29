import { Fragment, useState } from 'react';
import { Form } from 'react-router';

import type { Statut } from './badge.tsx';
import { CopyMarkdown } from './copy-command.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

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
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  return (
    <figure className="document">
      <figcaption className="reference">{fileName}</figcaption>
      {isModifiable ? (
        <Form method="post" action={`/offres/${reference}/${artefact}/document`} preventScrollReset>
          <input type="hidden" name="fileName" value={fileName} />
          <MarkdownEditor label="Markdown" name="markdown" defaultValue={markdown} onChange={setEditedMarkdown} />
          <div className="edition">
            <button type="submit" className="button--primary">
              Enregistrer
            </button>
            <CopyMarkdown markdown={editedMarkdown} />
            {editedMarkdown !== markdown && <p role="status">Modifications non enregistrées</p>}
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

const STATUT_BUTTON_LABEL_BY_STATUT: Record<Statut, string> = {
  a_traiter: 'Remettre À traiter',
  postulee: 'Marquer comme Postulée',
  archivee: 'Archiver',
};

// A button for each statut the action lets the Offre move to. Postulée is never undone and freezes
// the Lettre retenue, the one sent: it takes a second click, without a browser dialog.
export function StatutButtons({
  reference,
  nextStatutList,
}: Readonly<{ reference: string; nextStatutList: Statut[] }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isHydrated = useIsHydrated();
  return (
    <Form method="post" action={`/offres/${reference}/statut`} preventScrollReset className="edition">
      {nextStatutList.map((statut) => {
        if (statut !== 'postulee') {
          return (
            <button key={statut} type="submit" name="statut" value={statut}>
              {STATUT_BUTTON_LABEL_BY_STATUT[statut]}
            </button>
          );
        }
        return isConfirming ? (
          <Fragment key={statut}>
            <button type="submit" name="statut" value={statut} className="button--primary">
              Confirmer : Postulée
            </button>
            <button
              type="button"
              onClick={() => {
                setIsConfirming(false);
              }}
            >
              Annuler
            </button>
          </Fragment>
        ) : (
          <button
            key={statut}
            type="button"
            className="button--primary"
            disabled={!isHydrated}
            onClick={() => {
              setIsConfirming(true);
            }}
          >
            {STATUT_BUTTON_LABEL_BY_STATUT[statut]}
          </button>
        );
      })}
      {nextStatutList.includes('postulee') && (
        <p>Une fois Postulée, la Lettre retenue ne change plus : c’est celle envoyée.</p>
      )}
    </Form>
  );
}

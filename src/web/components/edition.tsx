import { Fragment, useState } from 'react';
import { Form } from 'react-router';

import type { Status } from './badge.tsx';
import { CopyMarkdown } from './copy-command.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

// What the Candidate changes from the Posting page. Each form posts to a route that relays to
// an action, then comes back to the Posting page where it was (ADR-0003).

interface IArtifactDocument {
  reference: string;
  artifact: string;
  fileName: string;
  markdown: string;
  // Given by the action: a file of the Chosen Version, except a Draft or a frozen Letter
  isModifiable: boolean;
}

// A file of a Version: the editor when the Candidate may correct it, saved in place in the Version
// chosen, else the text as written. Either copies as Markdown, the way it goes into a mail.
export function ArtifactDocument({
  reference,
  artifact,
  fileName,
  markdown,
  isModifiable,
}: Readonly<IArtifactDocument>) {
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  return (
    <figure className="document">
      <figcaption className="reference">{fileName}</figcaption>
      {isModifiable ? (
        <Form method="post" action={`/postings/${reference}/${artifact}/document`} preventScrollReset>
          <input type="hidden" name="fileName" value={fileName} />
          <MarkdownEditor
            label="Markdown"
            name="markdown"
            defaultValue={markdown}
            placeholder={'# Titre\n\nLe texte du document, en Markdown'}
            onChange={setEditedMarkdown}
          />
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

export function ChooseButton({
  reference,
  artifact,
  number,
}: Readonly<{ reference: string; artifact: string; number: number }>) {
  return (
    <Form method="post" action={`/postings/${reference}/${artifact}/chosen`} preventScrollReset className="edition">
      <input type="hidden" name="number" value={number} />
      <button type="submit">Retenir cette Version</button>
    </Form>
  );
}

const STATUS_BUTTON_LABEL_BY_STATUS: Record<Status, string> = {
  to_apply: 'Remettre À traiter',
  applied: 'Marquer comme Postulée',
  archived: 'Archiver',
};

// A button for each status the action lets the Posting move to. Applied is never undone and freezes
// the Chosen Letter, the one sent: it takes a second click, without a browser dialog.
export function StatusButtons({
  reference,
  nextStatusList,
}: Readonly<{ reference: string; nextStatusList: Status[] }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isHydrated = useIsHydrated();
  return (
    <Form method="post" action={`/postings/${reference}/status`} preventScrollReset className="edition">
      {nextStatusList.map((status) => {
        if (status !== 'applied') {
          return (
            <button key={status} type="submit" name="status" value={status}>
              {STATUS_BUTTON_LABEL_BY_STATUS[status]}
            </button>
          );
        }
        return isConfirming ? (
          <Fragment key={status}>
            <button type="submit" name="status" value={status} className="button--primary">
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
            key={status}
            type="button"
            className="button--primary"
            disabled={!isHydrated}
            onClick={() => {
              setIsConfirming(true);
            }}
          >
            {STATUS_BUTTON_LABEL_BY_STATUS[status]}
          </button>
        );
      })}
      {nextStatusList.includes('applied') && (
        <p>Une fois Postulée, la Lettre retenue ne change plus : c’est celle envoyée.</p>
      )}
    </Form>
  );
}

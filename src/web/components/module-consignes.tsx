import { useId, useState } from 'react';
import { Form } from 'react-router';

import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';
import { ARTEFACT_LABEL_BY_ARTEFACT, type IArtefactVersions } from './offre-fiche.tsx';

// The shape of the listConsignes action, so the route passes its result as is
export interface IModuleConsignes {
  module: IArtefactVersions['artefact'];
  defaultConsignes: string;
  candidatConsignes: string | null;
}

// Which Consignes a Version was produced with, so two Versions can be compared
export function ConsignesOrigin({ hasCandidatConsignes }: Readonly<{ hasCandidatConsignes: boolean }>) {
  return (
    <span className="consignes-origin">{hasCandidatConsignes ? 'Consignes du Candidat' : 'Consignes par défaut'}</span>
  );
}

// The Consignes of one module: the editor starts from the Candidat's own, or from the default ones
// until they have some. The route remounts it when the Consignes change hands, so the editor shows
// the ones now in effect. Only the Consignes are here: the fixed part of the prompt stays in the
// code, out of reach (ADR-0003).
export function ModuleConsignes({ module, defaultConsignes, candidatConsignes }: Readonly<IModuleConsignes>) {
  const headingId = useId();
  const hasCandidatConsignes = candidatConsignes !== null;
  const [draft, setDraft] = useState(candidatConsignes ?? defaultConsignes);
  return (
    <section className="artefact consignes" data-artefact={module} aria-labelledby={headingId}>
      <div className="consignes__head">
        <h2 id={headingId}>{ARTEFACT_LABEL_BY_ARTEFACT[module]}</h2>
        <span className="badge" data-consignes={hasCandidatConsignes ? 'candidat' : 'defaut'}>
          {hasCandidatConsignes ? 'Vos Consignes' : 'Consignes par défaut'}
        </span>
      </div>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="module" value={module} />
        <MarkdownEditor
          name="consignes"
          label={
            hasCandidatConsignes
              ? 'Vos Consignes, que suit le module'
              : 'Les Consignes par défaut, à modifier pour en faire les vôtres'
          }
          defaultValue={candidatConsignes ?? defaultConsignes}
          onChange={setDraft}
        />
        <div className="edition">
          <button type="submit" name="intent" value="save" className="button--primary">
            Enregistrer mes Consignes
          </button>
          {hasCandidatConsignes && (
            <button type="submit" name="intent" value="delete">
              Revenir aux Consignes par défaut
            </button>
          )}
          {draft !== (candidatConsignes ?? defaultConsignes) && <p role="status">Modifications non enregistrées</p>}
        </div>
      </Form>
      {hasCandidatConsignes && (
        <details className="consignes__default">
          <summary>Voir les Consignes par défaut</summary>
          <Markdown markdown={defaultConsignes} />
        </details>
      )}
    </section>
  );
}

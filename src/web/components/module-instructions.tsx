import { useId, useState } from 'react';
import { Form } from 'react-router';

import { ARTEFACT_LABEL_BY_ARTEFACT } from '#/actions/labels.ts';

import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';
import type { IArtefactVersions } from './offre-fiche.tsx';

// The shape of the listInstructions action, so the route passes its result as is
export interface IModuleInstructions {
  module: IArtefactVersions['artefact'];
  defaultInstructions: string;
  candidateInstructions: string | null;
}

// Which Instructions a Version was produced with, so two Versions can be compared
export function InstructionsOrigin({ hasCandidateInstructions }: Readonly<{ hasCandidateInstructions: boolean }>) {
  return (
    <span className="instructions-origin">
      {hasCandidateInstructions ? 'Consignes du Candidat' : 'Consignes par défaut'}
    </span>
  );
}

// The route remounts it when the Instructions change hands, so the editor shows those in effect; the
// fixed part of the prompt stays in the code, out of reach (ADR-0003)
export function ModuleInstructions({
  module,
  defaultInstructions,
  candidateInstructions,
}: Readonly<IModuleInstructions>) {
  const headingId = useId();
  const hasCandidateInstructions = candidateInstructions !== null;
  const [editedInstructions, setEditedInstructions] = useState(candidateInstructions ?? defaultInstructions);
  return (
    <section className="artefact instructions" data-artefact={module} aria-labelledby={headingId}>
      <div className="instructions__head">
        <h2 id={headingId}>{ARTEFACT_LABEL_BY_ARTEFACT[module]}</h2>
        <span className="badge" data-instructions={hasCandidateInstructions ? 'candidate' : 'default'}>
          {hasCandidateInstructions ? 'Vos Consignes' : 'Consignes par défaut'}
        </span>
      </div>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="module" value={module} />
        <MarkdownEditor
          name="instructions"
          label={
            hasCandidateInstructions
              ? 'Vos Consignes, que suit le module'
              : 'Les Consignes par défaut, à modifier pour en faire les vôtres'
          }
          defaultValue={candidateInstructions ?? defaultInstructions}
          placeholder={'- Un ton sobre et direct\n- Une page au plus'}
          onChange={setEditedInstructions}
        />
        <div className="edition">
          <button type="submit" name="intent" value="save" className="button--primary">
            Enregistrer mes Consignes
          </button>
          {hasCandidateInstructions && (
            <button type="submit" name="intent" value="delete">
              Revenir aux Consignes par défaut
            </button>
          )}
          {editedInstructions !== (candidateInstructions ?? defaultInstructions) && (
            <p role="status">Modifications non enregistrées</p>
          )}
        </div>
      </Form>
      {hasCandidateInstructions && (
        <details className="instructions__default">
          <summary>Voir les Consignes par défaut</summary>
          <Markdown markdown={defaultInstructions} />
        </details>
      )}
    </section>
  );
}

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form } from 'react-router';

import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';
import type { IArtifactVersions } from './posting-detail.tsx';

// The shape of the listInstructions action, so the route passes its result as is
export interface IModuleInstructions {
  module: IArtifactVersions['artifact'];
  defaultInstructions: string;
  candidateInstructions: string | null;
}

// Which Instructions a Version was produced with, so two Versions can be compared
export function InstructionsOrigin({ hasCandidateInstructions }: Readonly<{ hasCandidateInstructions: boolean }>) {
  const { t } = useTranslation('settings');
  return (
    <span className="instructions-origin">
      {hasCandidateInstructions ? t('instructions.candidateOrigin') : t('instructions.defaultOrigin')}
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
  const { t } = useTranslation('settings');
  const headingId = useId();
  const hasCandidateInstructions = candidateInstructions !== null;
  const [editedInstructions, setEditedInstructions] = useState(candidateInstructions ?? defaultInstructions);
  return (
    <section className="artifact instructions" data-artifact={module} aria-labelledby={headingId}>
      <div className="instructions__head">
        <h2 id={headingId}>{t(`artifactLabelByArtifact.${module}`, { ns: 'common' })}</h2>
        <span className="badge" data-instructions={hasCandidateInstructions ? 'candidate' : 'default'}>
          {hasCandidateInstructions ? t('instructions.candidateBadge') : t('instructions.defaultOrigin')}
        </span>
      </div>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="module" value={module} />
        <MarkdownEditor
          name="instructions"
          label={hasCandidateInstructions ? t('instructions.candidateLabel') : t('instructions.defaultLabel')}
          defaultValue={candidateInstructions ?? defaultInstructions}
          placeholder={t('instructions.placeholder')}
          onChange={setEditedInstructions}
        />
        <div className="edition">
          <button type="submit" name="intent" value="save" className="button button--primary">
            {t('instructions.save')}
          </button>
          {hasCandidateInstructions && (
            <button className="button" type="submit" name="intent" value="delete">
              {t('instructions.backToDefault')}
            </button>
          )}
          {editedInstructions !== (candidateInstructions ?? defaultInstructions) && (
            <p role="status">{t('unsavedChanges')}</p>
          )}
        </div>
      </Form>
      {hasCandidateInstructions && (
        <details className="instructions__default">
          <summary>{t('instructions.showDefault')}</summary>
          <Markdown markdown={defaultInstructions} />
        </details>
      )}
    </section>
  );
}

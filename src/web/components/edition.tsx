import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ButtonRow } from './button-row.tsx';
import { CopyMarkdown } from './copy-command.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';
import { Markdown } from './markdown.tsx';

import './edition.css';

// What the Candidate changes from the Posting page, inside the forms their Containers hand in

export interface IArtifactDocument {
  fileName: string;
  markdown: string;
  // Given by the action: a file of the Chosen Version, except a Draft or a frozen Letter
  isModifiable: boolean;
}

// A file of a Version: the editor when the Candidate may correct it, inside the form its Container
// saves in place in the Version chosen, else the text as written. Either copies as Markdown, the way
// it goes into a mail.
export function ArtifactDocument({
  fileName,
  markdown,
  isModifiable,
  error,
  renderForm,
}: Readonly<
  IArtifactDocument & { error: string | null | undefined; renderForm: (fieldList: ReactNode) => ReactNode }
>) {
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  const { t } = useTranslation('posting');
  return (
    <figure className="edition__document">
      <figcaption>{fileName}</figcaption>
      {isModifiable ? (
        renderForm(
          <>
            <input type="hidden" name="fileName" value={fileName} />
            <MarkdownEditor
              label={t('documentLabel')}
              name="markdown"
              defaultValue={markdown}
              placeholder={t('documentPlaceholder')}
              onChange={setEditedMarkdown}
            />
            <ButtonRow>
              <button type="submit" className="button button--primary">
                {t('save')}
              </button>
              <CopyMarkdown markdown={editedMarkdown} />
              {editedMarkdown !== markdown && <p role="status">{t('unsavedChanges')}</p>}
              {error != null && <p role="alert">{error}</p>}
            </ButtonRow>
          </>,
        )
      ) : (
        <>
          <Markdown markdown={markdown} />
          <ButtonRow>
            <CopyMarkdown markdown={markdown} />
          </ButtonRow>
        </>
      )}
    </figure>
  );
}

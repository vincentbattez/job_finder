import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ButtonRow } from './button-row.tsx';
import { Deletion } from './deletion.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';

import './profile-file.css';

// The forms its Container hands in, each around the fields it posts
type RenderForm = (fieldList: ReactNode) => ReactNode;

// The editor of a file, folded: a Profile of long files would otherwise run screens long
function FoldedContent({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation('settings');
  return (
    <details className="profile-file__content">
      <summary>{t('profileFile.content')}</summary>
      {children}
    </details>
  );
}

// One Markdown file of the Profile, such as facts.md, edited in place
export function ProfileFile({
  fileName,
  markdown,
  error,
  renderForm,
}: Readonly<{ fileName: string; markdown: string; error: string | null; renderForm: RenderForm }>) {
  const headingId = useId();
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  const { t } = useTranslation('settings');
  return (
    <section className="profile-file" aria-labelledby={headingId}>
      <h2 id={headingId}>{fileName}</h2>
      {renderForm(
        <>
          <input type="hidden" name="fileName" value={fileName} />
          <FoldedContent>
            <MarkdownEditor
              name="markdown"
              label={t('profileFile.contentOf', { fileName })}
              defaultValue={markdown}
              placeholder={t('profileFile.contentPlaceholder')}
              onChange={setEditedMarkdown}
            />
          </FoldedContent>
          <ButtonRow>
            <button type="submit" name="intent" value="save" className="button button--primary">
              {t('profileFile.save')}
            </button>
            {editedMarkdown !== markdown && <p role="status">{t('unsavedChanges')}</p>}
            {error !== null && <p role="alert">{error}</p>}
          </ButtonRow>
        </>,
      )}
      <Deletion summary={t('profileFile.deleteSummary', { fileName })}>
        {renderForm(
          <>
            <input type="hidden" name="fileName" value={fileName} />
            <ButtonRow>
              <p>{t('profileFile.deleteWarning')}</p>
              <button type="submit" name="intent" value="delete" className="button button--danger">
                {t('profileFile.deleteForGood', { fileName })}
              </button>
            </ButtonRow>
          </>,
        )}
      </Deletion>
    </section>
  );
}

// A new Markdown file of the Profile, empty or not; the action says why a name is refused
export function ProfileFileCreation({ error, renderForm }: Readonly<{ error: string | null; renderForm: RenderForm }>) {
  const headingId = useId();
  const fileNameId = useId();
  const { t } = useTranslation('settings');
  return (
    <section className="profile-file" data-new aria-labelledby={headingId}>
      <h2 id={headingId}>{t('profileFile.creationHeading')}</h2>
      {renderForm(
        <>
          <div className="profile-file__name">
            <label htmlFor={fileNameId}>{t('profileFile.fileName')}</label>
            <input
              id={fileNameId}
              type="text"
              name="fileName"
              required
              placeholder={t('profileFile.fileNamePlaceholder')}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <FoldedContent>
            <MarkdownEditor
              name="markdown"
              label={t('profileFile.creationContent')}
              defaultValue=""
              placeholder={t('profileFile.creationContentPlaceholder')}
            />
          </FoldedContent>
          <ButtonRow>
            <button type="submit" name="intent" value="create" className="button button--primary">
              {t('profileFile.create')}
            </button>
            {error !== null && <p role="alert">{error}</p>}
          </ButtonRow>
        </>,
      )}
    </section>
  );
}

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form } from 'react-router';

import { MarkdownEditor } from './markdown-editor.tsx';

import './profile-file.css';

// One Markdown file of the Profile, such as facts.md, edited in place
export function ProfileFile({
  fileName,
  markdown,
  error,
}: Readonly<{ fileName: string; markdown: string; error: string | null }>) {
  const headingId = useId();
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  const { t } = useTranslation('settings');
  return (
    <section className="profile-file" aria-labelledby={headingId}>
      <h2 id={headingId}>{fileName}</h2>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="fileName" value={fileName} />
        <MarkdownEditor
          name="markdown"
          label={t('profileFile.contentOf', { fileName })}
          defaultValue={markdown}
          placeholder={t('profileFile.contentPlaceholder')}
          onChange={setEditedMarkdown}
        />
        <div className="profile-file__actions">
          <button type="submit" name="intent" value="save" className="button button--primary">
            {t('profileFile.save')}
          </button>
          {editedMarkdown !== markdown && <p role="status">{t('unsavedChanges')}</p>}
          {error !== null && (
            <p role="alert" className="profile-file__error">
              {error}
            </p>
          )}
        </div>
      </Form>
      {/* Folded, so a deletion always takes a second, deliberate click, with or without JavaScript */}
      <details className="profile-file__delete">
        <summary>{t('profileFile.deleteSummary', { fileName })}</summary>
        <Form method="post" preventScrollReset className="profile-file__actions">
          <input type="hidden" name="fileName" value={fileName} />
          <p>{t('profileFile.deleteWarning')}</p>
          <button type="submit" name="intent" value="delete" className="button button--danger">
            {t('profileFile.deleteForGood', { fileName })}
          </button>
        </Form>
      </details>
    </section>
  );
}

// A new Markdown file of the Profile, empty or not; the action says why a name is refused
export function ProfileFileCreation({ error }: Readonly<{ error: string | null }>) {
  const headingId = useId();
  const fileNameId = useId();
  const { t } = useTranslation('settings');
  return (
    <section className="profile-file profile-file--new" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('profileFile.creationHeading')}</h2>
      <Form method="post" preventScrollReset>
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
        <MarkdownEditor
          name="markdown"
          label={t('profileFile.creationContent')}
          defaultValue=""
          placeholder={t('profileFile.creationContentPlaceholder')}
        />
        <div className="profile-file__actions">
          <button type="submit" name="intent" value="create" className="button button--primary">
            {t('profileFile.create')}
          </button>
          {error !== null && (
            <p role="alert" className="profile-file__error">
              {error}
            </p>
          )}
        </div>
      </Form>
    </section>
  );
}

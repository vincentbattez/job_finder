import { useId, useState } from 'react';
import { Form } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

import { MarkdownEditor } from './markdown-editor.tsx';

// One Markdown file of the Profile, such as facts.md, edited in place
export function ProfileFile({
  fileName,
  markdown,
  error,
}: Readonly<{ fileName: string; markdown: string; error: string | null }>) {
  const headingId = useId();
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  const { settings } = useCatalogue();
  const { profileFile } = settings;
  return (
    <section className="profile-file" aria-labelledby={headingId}>
      <h2 id={headingId} className="reference">
        {fileName}
      </h2>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="fileName" value={fileName} />
        <MarkdownEditor
          name="markdown"
          label={profileFile.contentOf(fileName)}
          defaultValue={markdown}
          placeholder={profileFile.contentPlaceholder}
          onChange={setEditedMarkdown}
        />
        <div className="edition">
          <button type="submit" name="intent" value="save" className="button--primary">
            {profileFile.save}
          </button>
          {editedMarkdown !== markdown && <p role="status">{settings.unsavedChanges}</p>}
          {error !== null && (
            <p role="alert" className="profile-file__error">
              {error}
            </p>
          )}
        </div>
      </Form>
      {/* Folded, so a deletion always takes a second, deliberate click, with or without JavaScript */}
      <details className="profile-file__delete">
        <summary>{profileFile.deleteSummary(fileName)}</summary>
        <Form method="post" preventScrollReset className="edition">
          <input type="hidden" name="fileName" value={fileName} />
          <p>{profileFile.deleteWarning}</p>
          <button type="submit" name="intent" value="delete" className="button--danger">
            {profileFile.deleteForGood(fileName)}
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
  const { profileFile } = useCatalogue().settings;
  return (
    <section className="profile-file profile-file--new" aria-labelledby={headingId}>
      <h2 id={headingId}>{profileFile.creationHeading}</h2>
      <Form method="post" preventScrollReset>
        <div className="profile-file__name">
          <label htmlFor={fileNameId}>{profileFile.fileName}</label>
          <input
            id={fileNameId}
            type="text"
            name="fileName"
            required
            placeholder={profileFile.fileNamePlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <MarkdownEditor
          name="markdown"
          label={profileFile.creationContent}
          defaultValue=""
          placeholder={profileFile.creationContentPlaceholder}
        />
        <div className="edition">
          <button type="submit" name="intent" value="create" className="button--primary">
            {profileFile.create}
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

import { useId, useState } from 'react';
import { Form } from 'react-router';

import { MarkdownEditor } from './markdown-editor.tsx';

// One Markdown file of the Profile, such as facts.md, edited in place
export function ProfileFile({
  fileName,
  markdown,
  error,
}: Readonly<{ fileName: string; markdown: string; error: string | null }>) {
  const headingId = useId();
  const [editedMarkdown, setEditedMarkdown] = useState(markdown);
  return (
    <section className="profile-file" aria-labelledby={headingId}>
      <h2 id={headingId} className="reference">
        {fileName}
      </h2>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="fileName" value={fileName} />
        <MarkdownEditor
          name="markdown"
          label={`Contenu de ${fileName}`}
          defaultValue={markdown}
          placeholder={'# Titre\n\n## Rubrique\n\n- Un fait par ligne, en Markdown'}
          onChange={setEditedMarkdown}
        />
        <div className="edition">
          <button type="submit" name="intent" value="save" className="button--primary">
            Enregistrer
          </button>
          {editedMarkdown !== markdown && <p role="status">Modifications non enregistrées</p>}
          {error !== null && (
            <p role="alert" className="profile-file__error">
              {error}
            </p>
          )}
        </div>
      </Form>
      {/* Folded, so a deletion always takes a second, deliberate click, with or without JavaScript */}
      <details className="profile-file__delete">
        <summary>Supprimer {fileName}…</summary>
        <Form method="post" preventScrollReset className="edition">
          <input type="hidden" name="fileName" value={fileName} />
          <p>L’outil ne s’en servira plus pour écrire à votre place. Ce fichier ne pourra pas être récupéré.</p>
          <button type="submit" name="intent" value="delete" className="button--danger">
            Supprimer définitivement {fileName}
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
  return (
    <section className="profile-file profile-file--new" aria-labelledby={headingId}>
      <h2 id={headingId}>Nouveau fichier</h2>
      <Form method="post" preventScrollReset>
        <div className="profile-file__name">
          <label htmlFor={fileNameId}>Nom du fichier</label>
          <input
            id={fileNameId}
            type="text"
            name="fileName"
            required
            placeholder="lettre-mairie-bethune-2025.md"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <MarkdownEditor
          name="markdown"
          label="Contenu, à remplir plus tard si besoin"
          defaultValue=""
          placeholder={
            '# Lettre de motivation, Mairie de Béthune, 2025\n\nMadame, Monsieur,\n\nTitulaire d’un master de droit public, je vous propose ma candidature…'
          }
        />
        <div className="edition">
          <button type="submit" name="intent" value="create" className="button--primary">
            Créer le fichier
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

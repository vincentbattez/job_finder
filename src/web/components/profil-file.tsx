import { useId, useState } from 'react';
import { Form } from 'react-router';

import { MarkdownEditor } from './markdown-editor.tsx';

// One Markdown file of the Profil, such as faits.md, edited in place
export function ProfilFile({ fileName, markdown }: Readonly<{ fileName: string; markdown: string }>) {
  const headingId = useId();
  const [draft, setDraft] = useState(markdown);
  return (
    <section className="profil-file" aria-labelledby={headingId}>
      <h2 id={headingId} className="reference">
        {fileName}
      </h2>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="fileName" value={fileName} />
        <MarkdownEditor name="markdown" label={`Contenu de ${fileName}`} defaultValue={markdown} onChange={setDraft} />
        <div className="edition">
          <button type="submit" className="button--primary">
            Enregistrer
          </button>
          {draft !== markdown && <p role="status">Modifications non enregistrées</p>}
        </div>
      </Form>
    </section>
  );
}

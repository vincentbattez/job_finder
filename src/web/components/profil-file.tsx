import { useId } from 'react';
import { useFetcher } from 'react-router';

import { MarkdownEditor } from './markdown-editor.tsx';
import { SaveStatus } from './save-status.tsx';

// One Markdown file of the Profil, such as faits.md, edited in place
export function ProfilFile({ fileName, markdown }: Readonly<{ fileName: string; markdown: string }>) {
  const headingId = useId();
  // Each file saves on its own, without leaving the page
  const fetcher = useFetcher<{ isSaved: boolean }>();
  return (
    <section className="profil-file" aria-labelledby={headingId}>
      <h2 id={headingId} className="reference">
        {fileName}
      </h2>
      <fetcher.Form method="post">
        <input type="hidden" name="fileName" value={fileName} />
        <MarkdownEditor name="markdown" label={`Contenu de ${fileName}`} defaultValue={markdown} />
        <div className="form-actions">
          <button type="submit" className="button button--primary">
            Enregistrer
          </button>
          <SaveStatus state={fetcher.state} isSaved={fetcher.data?.isSaved === true} />
        </div>
      </fetcher.Form>
    </section>
  );
}

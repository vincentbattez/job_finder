import { useId, useState } from 'react';

import { Markdown } from './markdown.tsx';

export function MarkdownEditor({ label, defaultValue }: Readonly<{ label: string; defaultValue: string }>) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const textareaId = useId();
  const previewId = useId();
  return (
    <div className="editor">
      <div className="editor__pane">
        <label htmlFor={textareaId}>{label}</label>
        <textarea
          id={textareaId}
          value={markdown}
          spellCheck
          onChange={(event) => {
            setMarkdown(event.target.value);
          }}
        />
      </div>
      <section className="editor__pane" aria-labelledby={previewId}>
        <h4 id={previewId} className="editor__label">
          Aperçu
        </h4>
        <Markdown markdown={markdown} />
      </section>
    </div>
  );
}

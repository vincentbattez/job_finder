import { useId, useState } from 'react';

import { Markdown } from './markdown.tsx';

// Within a form, name sends the text typed
export function MarkdownEditor({
  label,
  defaultValue,
  name,
}: Readonly<{ label: string; defaultValue: string; name?: string }>) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const textareaId = useId();
  const previewId = useId();
  return (
    <div className="editor">
      <div className="editor__pane">
        <label htmlFor={textareaId}>{label}</label>
        <textarea
          id={textareaId}
          name={name}
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

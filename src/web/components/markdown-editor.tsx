import { useId, useState } from 'react';

import { Markdown } from './markdown.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

// The textarea posts its text under `name` within a form. It stays read-only until React runs the
// page: React taking over the field resets it, which would drop or misplace the text typed before.
export function MarkdownEditor({
  label,
  name,
  defaultValue,
  onChange,
}: Readonly<{ label: string; name?: string; defaultValue: string; onChange?: (markdown: string) => void }>) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const textareaId = useId();
  const previewId = useId();
  const isHydrated = useIsHydrated();
  return (
    <div className="editor">
      <div className="editor__pane">
        <label htmlFor={textareaId}>{label}</label>
        <textarea
          id={textareaId}
          name={name}
          value={markdown}
          readOnly={!isHydrated}
          spellCheck
          onChange={(event) => {
            setMarkdown(event.target.value);
            onChange?.(event.target.value);
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

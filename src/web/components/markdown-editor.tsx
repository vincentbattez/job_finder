import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Markdown } from './markdown.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

import './markdown-editor.css';

// The textarea posts its text under `name` within a form. It stays read-only until React runs the
// page: React taking over the field resets it, which would drop or misplace the text typed before.
export function MarkdownEditor({
  label,
  name,
  defaultValue,
  placeholder,
  onChange,
}: Readonly<{
  label: string;
  name?: string;
  defaultValue: string;
  // Shown while the file is empty: what such a file holds, in Markdown
  placeholder: string;
  onChange?: (markdown: string) => void;
}>) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const textareaId = useId();
  const previewId = useId();
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  return (
    <div className="markdown-editor">
      <div className="markdown-editor__pane">
        <label className="markdown-editor__label" htmlFor={textareaId}>
          {label}
        </label>
        <textarea
          id={textareaId}
          name={name}
          value={markdown}
          readOnly={!isHydrated}
          placeholder={placeholder}
          spellCheck
          onChange={(event) => {
            setMarkdown(event.target.value);
            onChange?.(event.target.value);
          }}
        />
      </div>
      <section className="markdown-editor__pane" aria-labelledby={previewId}>
        <h4 id={previewId} className="markdown-editor__label">
          {t('preview')}
        </h4>
        <Markdown markdown={markdown} />
      </section>
    </div>
  );
}

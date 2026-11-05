import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '#/web/components/ui/label.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

import { Markdown } from './markdown.tsx';

// A Markdown text beside its preview: the textarea posts under `name` within a form. It only mounts
// once the Candidate unfolds it, so React never resets what was typed by hydrating it.
export function MarkdownEditor({
  label,
  name,
  defaultValue,
  placeholder,
  isRequired = false,
  onChange,
}: Readonly<{
  label: string;
  name: string;
  defaultValue: string;
  // Shown while the file is empty: what such a file holds, in Markdown
  placeholder: string;
  isRequired?: boolean;
  onChange?: (markdown: string) => void;
}>) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const textareaId = useId();
  const previewId = useId();
  const { t } = useTranslation('posting');
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid min-w-0 content-start gap-2">
        <Label htmlFor={textareaId}>{label}</Label>
        <Textarea
          id={textareaId}
          name={name}
          value={markdown}
          required={isRequired}
          rows={12}
          placeholder={placeholder}
          className="field-sizing-fixed font-mono text-xs"
          onChange={(event) => {
            setMarkdown(event.target.value);
            onChange?.(event.target.value);
          }}
        />
      </div>
      <section aria-labelledby={previewId} className="grid min-w-0 content-start gap-2">
        <h4 id={previewId} className="text-sm font-medium">
          {t('preview')}
        </h4>
        <div className="max-h-72 overflow-auto rounded-lg border p-3 text-sm">
          <Markdown markdown={markdown} />
        </div>
      </section>
    </div>
  );
}

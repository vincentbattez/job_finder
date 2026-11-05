import { TriangleAlertIcon } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '#/web/components/ui/alert.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

import { useIsHydrated } from './use-is-hydrated.ts';

// MDXEditor never renders on the server: its module is loaded once React runs the page
const MDX_EDITOR = lazy(async () => {
  const editorModule = await import('./mdx/mdx-editor.tsx');
  return { default: editorModule.MdxEditor };
});

function EditorPlaceholder() {
  const { t } = useTranslation('posting');
  return (
    <div role="status" className="h-[60vh] animate-pulse bg-muted/30">
      <span className="sr-only">{t('artifactView.editor.loading')}</span>
    </div>
  );
}

// « Modifier » a Version (spec #125, « Correcting and comparing »): MDXEditor for an MDX Artifact, the Letter
// as plain Markdown; should the visual editor not read the text, its source in a plain field instead. The
// text typed goes up through onChange; the actions sit beside it.
export function ArtifactEditor({
  text,
  original,
  format,
  number,
  onChange,
  actions,
}: Readonly<{
  text: string;
  original: string | null;
  format: 'mdx' | 'markdown';
  number: number;
  onChange: (text: string) => void;
  actions: ReactNode;
}>) {
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  const [error, setError] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState(text);
  const label = t('artifactView.editor.label', { number });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {format === 'markdown' ? t('artifactView.editor.introLetter') : t('artifactView.editor.introMdx')}
        </p>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {error === null ? null : (
        <Alert>
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>{t('artifactView.editor.notReadable')}</AlertDescription>
        </Alert>
      )}
      <div data-artifact-editor className="overflow-hidden rounded-xl border bg-background">
        {error === null && isHydrated ? (
          <Suspense fallback={<EditorPlaceholder />}>
            <MDX_EDITOR
              text={text}
              original={original}
              format={format}
              label={label}
              onChange={onChange}
              onError={setError}
            />
          </Suspense>
        ) : null}
        {error === null && !isHydrated ? <EditorPlaceholder /> : null}
        {error === null ? null : (
          <Textarea
            aria-label={label}
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              onChange(event.target.value);
            }}
            className="min-h-[60vh] rounded-none border-0 font-mono text-sm"
          />
        )}
      </div>
    </div>
  );
}

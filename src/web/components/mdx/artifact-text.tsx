import { cn } from 'cn';
import { TriangleAlertIcon } from 'lucide-react';
import { createElement, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { MDX_CATALOGUE } from './catalogue.tsx';
import { compileArtifactText, UNKNOWN_COMPONENT_NAME, type ArtifactTextFormat } from './compile.ts';

export type { ArtifactTextFormat } from './compile.ts';

const COMPONENT_NAME_SET: ReadonlySet<string> = new Set(
  Object.keys(MDX_CATALOGUE).filter((name) => /^[A-Z]/u.test(name)),
);

// The discreet block of what the catalogue does not know: its name, then its children as they are
function UnknownComponent({
  name,
  inline,
  children,
}: Readonly<{ name?: string; inline?: string; children?: ReactNode }>) {
  const { t } = useTranslation('mdx');
  if (inline !== undefined) {
    return (
      <span className="rounded-sm border border-dashed border-destructive/40 px-1 text-muted-foreground">
        <span className="font-mono text-xs text-destructive">{t('unknownComponent', { name })}</span> {children}
      </span>
    );
  }
  return (
    <div className="not-prose my-3 rounded-md border border-dashed border-destructive/40 px-3 py-2 text-sm text-muted-foreground">
      <p className="font-mono text-xs text-destructive">{t('unknownComponent', { name })}</p>
      {children === undefined ? null : <div className="mt-1">{children}</div>}
    </div>
  );
}

const COMPONENTS = { ...MDX_CATALOGUE, [UNKNOWN_COMPONENT_NAME]: UnknownComponent };

// An Artifact's text as a document: MDX through the closed catalogue, or the Letter's plain Markdown
// (ADR-0020). Compiled from the text alone, so the server and the browser render the same.
export function ArtifactText({
  text,
  format,
  className,
}: Readonly<{ text: string; format: ArtifactTextFormat; className?: string }>) {
  const { t } = useTranslation('mdx');
  const { content, hasFailed } = useMemo(() => compileArtifactText(text, format, COMPONENT_NAME_SET), [text, format]);
  return (
    <div className={cn('prose max-w-none dark:prose-invert', className)}>
      {hasFailed ? (
        <p
          role="note"
          className="not-prose mb-4 flex items-start gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('notCompiled')}
        </p>
      ) : null}
      {createElement(content, { components: COMPONENTS })}
    </div>
  );
}

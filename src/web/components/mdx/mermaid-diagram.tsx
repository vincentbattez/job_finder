import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';

function DiagramPlaceholder() {
  const { t } = useTranslation('mdx');
  return <div role="status" aria-label={t('diagramLoading')} className="h-40 animate-pulse rounded-md bg-muted/50" />;
}

// Mermaid needs the DOM: imported only in the browser, and drawn again on a theme switch
function MermaidRender({ code }: Readonly<{ code: string }>) {
  const { t } = useTranslation('mdx');
  const { resolvedTheme } = useTheme();
  const id = useId().replaceAll(/[^a-zA-Z0-9]/gu, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    // An object, so that the cleanup's change is seen by the render still running
    const run = { isCancelled: false };
    void (async () => {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: isDark ? 'dark' : 'neutral',
        fontFamily: 'Inter Variable, ui-sans-serif, system-ui, sans-serif',
      });
      try {
        const result = await mermaid.render(`mermaid-${id}-${isDark ? 'dark' : 'light'}`, code);
        if (!run.isCancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (!run.isCancelled) {
          setError(renderError instanceof Error ? renderError.message : String(renderError));
        }
      }
    })();
    return () => {
      run.isCancelled = true;
    };
  }, [code, id, isDark]);

  if (error !== null) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-destructive">{t('diagramUnreadable', { reason: error.split('\n', 1)[0] })}</p>
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {code}
        </pre>
      </div>
    );
  }
  if (svg === null) {
    return <DiagramPlaceholder />;
  }
  return (
    <div
      className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-h-[28rem] [&_svg]:max-w-full"
      // Mermaid's own SVG, rendered with securityLevel strict, which sanitizes labels
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// The server and the first client render show the placeholder, so they agree
export function MermaidDiagram({ code }: Readonly<{ code: string }>) {
  return useIsHydrated() ? <MermaidRender code={code.trim()} /> : <DiagramPlaceholder />;
}

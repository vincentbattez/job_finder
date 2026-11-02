// PROTOTYPE · Posting page agent. A Mermaid diagram of the MDX catalogue: rendered in the browser only
// (mermaid needs the DOM), again on a theme switch; until then, and on a syntax error, its source.
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

import { ClientOnly } from '#/web/prototype/lib/client-only.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

function DiagramSource({ code, error }: { code: string; error?: string | null }) {
  return (
    <div className="space-y-2">
      {error === undefined || error === null ? null : (
        <p className="text-xs text-destructive">Diagramme illisible : {error.split('\n')[0]}</p>
      )}
      <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
        {code}
      </pre>
    </div>
  );
}

function MermaidRender({ code }: { code: string }) {
  const { resolvedTheme } = useTheme();
  const id = useId().replaceAll(/[^a-zA-Z0-9]/gu, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: isDark ? 'dark' : 'neutral',
        fontFamily: 'Inter Variable, ui-sans-serif, system-ui, sans-serif',
        flowchart: { curve: 'basis', padding: 12 },
      });
      try {
        const result = await mermaid.render(`mermaid-${id}-${isDark ? 'dark' : 'light'}`, code);
        if (!isCancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (!isCancelled) {
          setError(renderError instanceof Error ? renderError.message : String(renderError));
        }
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [code, id, isDark]);

  if (error !== null) {
    return <DiagramSource code={code} error={error} />;
  }
  if (svg === null) {
    return <div className="h-40 animate-pulse rounded-md bg-muted/50" />;
  }
  return (
    <div
      className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // Mermaid's own SVG, rendered with securityLevel strict
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  return (
    <div className={cn('not-prose', className)}>
      <ClientOnly fallback={<div className="h-40 animate-pulse rounded-md bg-muted/50" />}>
        {() => <MermaidRender code={code.trim()} />}
      </ClientOnly>
    </div>
  );
}

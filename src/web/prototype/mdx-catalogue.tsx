// PROTOTYPE · owned by the Posting page agent (with posting.tsx and revision.tsx). The closed MDX
// catalogue of the Artifacts, all on shadcn (DECISIONS.md « Artifacts », ADR-0020): Callout (Alert),
// Tabs, Accordion, Card, Badge, Table, Steps/Timeline, Quote, Checklist, Diagram (Mermaid, client-only).
// Only plain string attributes and children reach a component (mdx.tsx strips every `{…}`), so design
// each one by composition: <Steps><Step title="…">…</Step></Steps>, not <Steps items={[…]} />.
//
// Callout below is only the example that proves the pipeline: replace it and add the others.
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '#/web/prototype/components/ui/alert.tsx';

import type { MdxCatalogue } from './mdx.tsx';

function Callout({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <Alert className="not-prose my-4">
      {title === undefined ? null : <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export const MDX_CATALOGUE: MdxCatalogue = { Callout };

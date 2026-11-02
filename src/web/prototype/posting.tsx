// PROTOTYPE · PLACEHOLDER owned by the Posting page agent (with revision.tsx and mdx-catalogue.tsx):
// /prototype/postings/:reference, as DECISIONS.md « Posting page » and « Artifacts » describe it:
// header with ONE primary action and a ⋯ menu, Tabs Posting | Research | Letter | Interviews | Notes,
// Documents, the per-Artifact toolbar, reading mode (MDX) and MDXEditor, Resizable comparison; variants
// on ?variant=. It imports the generation panel, owned by another agent. Replace it all.
import { useState } from 'react';
import {
  Link,
  useLoaderData,
  useParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/web/prototype/components/ui/card.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';

import { loadPostingDetail } from './data.server.ts';
import { GenerationPanel } from './generation-panel.tsx';
import { MDX_CATALOGUE } from './mdx-catalogue.tsx';
import { Mdx } from './mdx.tsx';
import { chosenVersionOf, formatDate, STEP_LABEL, VERSION_STATE_LABEL } from './model.ts';
import { PageHeader } from './page-header.tsx';
import { usePosting, usePostingDetail, useRuns } from './store.ts';

export function loader({ request, params }: LoaderFunctionArgs) {
  return loadPostingDetail(request, params.reference ?? '');
}

// The snapshot never changes: loaded again only for another Posting, never for a ?variant=
export function shouldRevalidate({ currentParams, nextParams, currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  return currentParams.reference !== nextParams.reference || currentUrl.href === nextUrl.href;
}

export default function PostingPage() {
  const { reference = '' } = useParams();
  const posting = usePosting(reference);
  const detail = usePostingDetail(reference, useLoaderData<typeof loader>());
  const runs = useRuns(reference).filter(({ status }) => status === 'running');
  const [panelKey, setPanelKey] = useState<string | null>(null);
  if (posting === undefined || detail === null) {
    return <PageHeader title="Offre introuvable" description={reference} />;
  }
  const panelArtifact = detail.artifacts.find(({ key }) => key === panelKey);
  return (
    <>
      <PageHeader
        title={posting.title}
        description={`${posting.employer ?? '—'} · ${posting.city ?? '—'} · ${formatDate(posting.deadline)}`}
        actions={<Badge>{STEP_LABEL[posting.step]}</Badge>}
      />
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">Placeholder de la page Offre.</p>
        {runs.map((run) => (
          <div key={run.id} className="space-y-1 text-sm">
            <p>
              {run.label} · {run.phase}
            </p>
            <Progress value={run.progress * 100} />
          </div>
        ))}
        {detail.artifacts.map((artifact) => {
          const chosen = chosenVersionOf(artifact);
          const latest = artifact.versions.at(-1);
          return (
            <Card key={artifact.key}>
              <CardHeader>
                <CardTitle>
                  {artifact.label}
                  {artifact.interviewNumber === null ? '' : ` · Entretien ${String(artifact.interviewNumber)}`}
                </CardTitle>
                <CardDescription>
                  {artifact.versions.length} Version(s)
                  {latest === undefined ? '' : ` · dernière : ${VERSION_STATE_LABEL[latest.state]}`}
                  {artifact.refusal === null ? '' : ` · ${artifact.refusal}`}
                </CardDescription>
                <CardAction>
                  <Button size="sm" variant="outline" onClick={() => setPanelKey(artifact.key)}>
                    Générer
                  </Button>
                </CardAction>
              </CardHeader>
              {chosen === undefined || artifact.format !== 'mdx' ? null : (
                <CardContent className="max-h-64 overflow-auto">
                  <Mdx
                    source={chosen.text}
                    components={MDX_CATALOGUE}
                    className="prose prose-sm max-w-none dark:prose-invert"
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
        {posting.interviews.map((interview) => (
          <Button key={interview.number} asChild variant="link">
            <Link to={`/prototype/postings/${reference}/interviews/${String(interview.number)}/revision`}>
              Réviser l’Entretien {interview.number}
            </Link>
          </Button>
        ))}
      </div>
      {panelArtifact === undefined ? null : (
        <GenerationPanel
          artifact={panelArtifact}
          posting={posting}
          interview={posting.interviews.find(({ number }) => number === panelArtifact.interviewNumber)}
          onClose={() => setPanelKey(null)}
        />
      )}
    </>
  );
}

// PROTOTYPE · a throwaway harness for the generation panel, while the Posting page is being built:
// /prototype/generation-demo/:reference lists the Posting's Artifacts (Research, Letter, then a Portrait
// and an Interview Brief per Interview) with their Versions; ?artifact=<key> opens the panel on it
// (e.g. ?artifact=interview_brief@1&panel=C), so a screenshot can land straight on it.
import { SparklesIcon } from 'lucide-react';
import {
  Link,
  useLoaderData,
  useParams,
  useSearchParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';

import { loadPostingDetail } from '../data.server.ts';
import { GenerationPanel } from '../generation-panel.tsx';
import {
  ARTIFACT_LABEL,
  artifactKeyOf,
  formatDateTime,
  VERSION_STATE_LABEL,
  type GeneratedArtifactType,
  type IArtifact,
} from '../model.ts';
import { PageHeader } from '../page-header.tsx';
import { usePosting, usePostingDetail, useRuns } from '../store.ts';

export function loader({ request, params }: LoaderFunctionArgs) {
  return loadPostingDetail(request, params.reference ?? '');
}

export function shouldRevalidate({ currentParams, nextParams, currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  return currentParams.reference !== nextParams.reference || currentUrl.href === nextUrl.href;
}

function emptyArtifact(type: GeneratedArtifactType, interviewNumber: number | null): IArtifact {
  return {
    key: artifactKeyOf(type, interviewNumber),
    type,
    label: ARTIFACT_LABEL[type],
    interviewNumber,
    format: type === 'letter' ? 'markdown' : 'mdx',
    versions: [],
    chosenNumber: null,
    refusal: null,
    fixedPart: null,
    isFixedPartExample: false,
  };
}

export default function GenerationDemoPage() {
  const { reference = '' } = useParams();
  const posting = usePosting(reference);
  const detail = usePostingDetail(reference, useLoaderData<typeof loader>());
  const runs = useRuns(reference);
  const [searchParams, setSearchParams] = useSearchParams();
  if (posting === undefined || detail === null) {
    return <PageHeader title="Offre introuvable" description={reference} />;
  }
  const slotList: IArtifact[] = [
    ...(['research', 'letter'] as const).map((type) => emptyArtifact(type, null)),
    ...posting.interviews.flatMap(({ number }) =>
      (['portrait', 'interview_brief'] as const).map((type) => emptyArtifact(type, number)),
    ),
  ].map((empty) => detail.artifacts.find(({ key }) => key === empty.key) ?? empty);
  const openKey = searchParams.get('artifact');
  const openArtifact = slotList.find(({ key }) => key === openKey);

  function open(key: string | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === null) {
          next.delete('artifact');
        } else {
          next.set('artifact', key);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return (
    <>
      <PageHeader
        title="Démo du panneau de génération"
        description={`${posting.title} · ${posting.employer ?? '—'}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/prototype/postings/${reference}`}>Page de l’Offre</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Harnais jetable : chaque « Générer » ouvre le panneau (variantes sur ?panel=, Maj + ←→).
        </p>
        <ul className="divide-y rounded-lg border">
          {slotList.map((artifact) => {
            const latest = artifact.versions.at(-1);
            const run = runs.find(({ artifactKey, status }) => artifactKey === artifact.key && status === 'running');
            return (
              <li key={artifact.key} className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {artifact.label}
                      {artifact.interviewNumber === null ? '' : ` · Entretien ${String(artifact.interviewNumber)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {latest === undefined
                        ? 'Aucune Version'
                        : `v${String(latest.number)} · ${VERSION_STATE_LABEL[latest.state]} · ${formatDateTime(latest.createdAt)}`}
                      {artifact.chosenNumber === null ? '' : ` · retenue : v${String(artifact.chosenNumber)}`}
                    </p>
                    {latest === undefined || latest.inputs.length === 0 ? null : (
                      <p className="text-xs text-muted-foreground">
                        Produite à partir de : {latest.inputs.map(({ label }) => label).join(', ')}
                      </p>
                    )}
                  </div>
                  {latest === undefined ? null : (
                    <Badge variant={latest.state === 'draft' ? 'outline' : 'secondary'}>
                      {VERSION_STATE_LABEL[latest.state]}
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => open(artifact.key)} data-generate={artifact.key}>
                    <SparklesIcon data-icon="inline-start" />
                    {latest === undefined ? 'Générer' : 'Regénérer'}
                  </Button>
                </div>
                {run === undefined ? null : (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{run.phase}…</p>
                    <Progress value={run.progress * 100} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {openArtifact === undefined ? null : (
        <GenerationPanel
          key={openArtifact.key}
          artifact={openArtifact}
          posting={posting}
          interview={posting.interviews.find(({ number }) => number === openArtifact.interviewNumber)}
          onClose={() => open(null)}
        />
      )}
    </>
  );
}

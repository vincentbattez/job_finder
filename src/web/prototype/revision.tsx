// PROTOTYPE · PLACEHOLDER owned by the Posting page agent: /prototype/postings/:reference/interviews/
// :number/revision, the full-screen « Réviser l'Entretien » (DECISIONS.md « Revision »), out of the
// Sidebar: the Interview Brief full width, a countdown to the Interview, side access to the Portrait
// and the Posting; variants on ?variant=. Replace it all.
import { ArrowLeftIcon } from 'lucide-react';
import {
  Link,
  useLoaderData,
  useParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { Button } from '#/web/prototype/components/ui/button.tsx';

import { loadPostingDetail } from './data.server.ts';
import { MDX_CATALOGUE } from './mdx-catalogue.tsx';
import { Mdx } from './mdx.tsx';
import { artifactKeyOf, chosenVersionOf, formatCountdown, formatDateTime } from './model.ts';
import { usePosting, usePostingDetail } from './store.ts';
import { ThemeToggle } from './theme-toggle.tsx';

export function loader({ request, params }: LoaderFunctionArgs) {
  return loadPostingDetail(request, params.reference ?? '');
}

export function shouldRevalidate({ currentParams, nextParams, currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  return currentParams.reference !== nextParams.reference || currentUrl.href === nextUrl.href;
}

export default function RevisionPage() {
  const { reference = '', number = '' } = useParams();
  const posting = usePosting(reference);
  const detail = usePostingDetail(reference, useLoaderData<typeof loader>());
  const interview = posting?.interviews.find((other) => String(other.number) === number);
  const brief = detail?.artifacts.find(({ key }) => key === artifactKeyOf('interview_brief', Number(number)));
  const chosen = brief === undefined ? undefined : chosenVersionOf(brief);
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Retour à l’Offre">
          <Link to={`/prototype/postings/${reference}`}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">Réviser l’Entretien {number}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {posting?.title ?? reference}
            {interview === undefined
              ? ''
              : ` · ${formatDateTime(interview.startAt)} (${formatCountdown(interview.startAt)})`}
          </p>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <p className="mb-4 text-sm text-muted-foreground">Placeholder de la Révision.</p>
        {chosen === undefined ? (
          <p>Pas encore de Fiche d’entretien validée.</p>
        ) : (
          <Mdx source={chosen.text} components={MDX_CATALOGUE} className="prose max-w-none dark:prose-invert" />
        )}
      </main>
    </div>
  );
}

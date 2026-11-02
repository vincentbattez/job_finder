// PROTOTYPE · owned by the Posting page agent (with revision.tsx, mdx-catalogue.tsx and posting/).
// /prototype/postings/:reference (DECISIONS.md « Posting page », « Artifacts »): a header with ONE
// primary action that follows the Step and a ⋯ menu; Tabs following the workflow, deep-linkable with
// ?tab=posting|research|letter|interviews|notes; the Documents section on the Posting tab; each
// Artifact through the shared Artifact view (posting/artifact-view.tsx), whose reading layout has three
// variants on ?variant=A|B|C (posting/reader.tsx). The generation panel belongs to another agent.
import {
  useLoaderData,
  useParams,
  useSearchParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Tabs, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { loadPostingDetail } from './data.server.ts';
import { formatCountdown, formatDate, summaryOf, type ArtifactState } from './model.ts';
import { PageHeader } from './page-header.tsx';
import { ArtifactView } from './posting/artifact-view.tsx';
import { PostingActions } from './posting/header-actions.tsx';
import { InterviewsTab } from './posting/interviews-tab.tsx';
import { NotesTab } from './posting/notes-tab.tsx';
import { PostingTab } from './posting/posting-tab.tsx';
import { READING_VARIANT_LIST, type ReadingVariant } from './posting/reader.tsx';
import { PrototypeSwitcher, usePrototypeVariant } from './prototype-switcher.tsx';
import { usePosting, usePostingDetail } from './store.ts';

export function loader({ request, params }: LoaderFunctionArgs) {
  return loadPostingDetail(request, params.reference ?? '');
}

// The snapshot never changes: loaded again only for another Posting, never for a ?variant= or ?tab=
export function shouldRevalidate({ currentParams, nextParams, currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  return currentParams.reference !== nextParams.reference || currentUrl.href === nextUrl.href;
}

const TAB_LIST = ['posting', 'research', 'letter', 'interviews', 'notes'] as const;
type Tab = (typeof TAB_LIST)[number];

const TAB_LABEL: Record<Tab, string> = {
  posting: 'Offre',
  research: 'Recherche',
  letter: 'Lettre de motivation',
  interviews: 'Entretiens',
  notes: 'Notes',
};

function isTab(value: string | null): value is Tab {
  return TAB_LIST.some((tab) => tab === value);
}

function StateDot({ state }: { state: ArtifactState }) {
  const label = state === 'draft' ? 'Brouillon à valider' : state === 'validated' ? 'Validée' : 'Pas encore';
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-block size-1.5 rounded-full',
        state === 'none' && 'bg-muted-foreground/30',
        state === 'draft' && 'bg-primary',
        state === 'validated' && 'bg-emerald-600 dark:bg-emerald-400',
      )}
    />
  );
}

export default function PostingPage() {
  const { reference = '' } = useParams();
  const posting = usePosting(reference);
  const detail = usePostingDetail(reference, useLoaderData<typeof loader>());
  const [searchParams, setSearchParams] = useSearchParams();
  const variant = usePrototypeVariant('variant', READING_VARIANT_LIST) as ReadingVariant;
  const requestedTab = searchParams.get('tab');
  const tab: Tab = isTab(requestedTab) ? requestedTab : 'posting';

  if (posting === undefined || detail === null) {
    return <PageHeader title="Offre introuvable" description={reference} />;
  }

  function setTab(value: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', value);
        if (value !== 'interviews') {
          next.delete('interview');
          next.delete('doc');
        }
        return next;
      },
      { preventScrollReset: true },
    );
  }

  const meta = [
    posting.employer,
    posting.city,
    posting.deadline === null
      ? null
      : `Date limite ${formatDate(posting.deadline)} (${formatCountdown(posting.deadline)})`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  const isReadingTab = tab === 'research' || tab === 'letter' || tab === 'interviews';

  return (
    <>
      <PageHeader title={posting.title} description={meta} actions={<PostingActions posting={posting} />} />
      <div className="mx-auto w-full max-w-[96rem] px-4 pt-3 pb-24 sm:px-6 lg:px-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b px-0 pb-1 group-data-horizontal/tabs:h-auto"
          >
            {TAB_LIST.map((value) => (
              <TabsTrigger key={value} value={value} className="flex-none gap-2 px-3 py-2">
                {value === 'research' ? (
                  <StateDot state={summaryOf(detail.artifacts.find(({ key }) => key === 'research')).state} />
                ) : null}
                {value === 'letter' ? (
                  <StateDot state={summaryOf(detail.artifacts.find(({ key }) => key === 'letter')).state} />
                ) : null}
                {TAB_LABEL[value]}
                {value === 'interviews' && posting.interviews.length > 0 ? (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] tabular-nums">
                    {posting.interviews.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="pt-6">
          {tab === 'posting' ? <PostingTab posting={posting} detail={detail} /> : null}
          {tab === 'research' ? (
            <ArtifactView
              posting={posting}
              artifactKey="research"
              type="research"
              artifact={detail.artifacts.find(({ key }) => key === 'research')}
              variant={variant}
              canFocus
            />
          ) : null}
          {tab === 'letter' ? (
            <ArtifactView
              posting={posting}
              artifactKey="letter"
              type="letter"
              artifact={detail.artifacts.find(({ key }) => key === 'letter')}
              variant={variant}
              recipients={detail.recipients}
              canFocus
            />
          ) : null}
          {tab === 'interviews' ? <InterviewsTab posting={posting} detail={detail} variant={variant} /> : null}
          {tab === 'notes' ? <NotesTab posting={posting} /> : null}
        </div>
      </div>
      {isReadingTab ? <PrototypeSwitcher variants={READING_VARIANT_LIST} label="Lecture" /> : null}
    </>
  );
}

import { cn } from 'cn';
import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileSearchIcon,
  Loader2Icon,
  MapPinIcon,
  PenLineIcon,
  RepeatIcon,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';

import type { Actions } from '#/actions/index.ts';
import { Button } from '#/web/components/ui/button.tsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#/web/components/ui/sheet.tsx';

import { ContactList } from './posting-facts.tsx';
import { StepBadge } from './step-badge.tsx';

type SheetPosting = Awaited<ReturnType<Actions['readPosting']>>;
type ArtifactEntry = SheetPosting['artifactList'][number];

// Where a line of the Sheet says its Artifact stands: a run under way first, then its Draft or its
// Validated Version (ADR-0019), a failed run, or nothing yet
type ArtifactLineState = 'running' | 'draft' | 'validated' | 'failed' | 'none';

function lineStateOf({ state, validation }: ArtifactEntry): ArtifactLineState {
  if (state === 'queued' || state === 'in_progress') {
    return 'running';
  }
  if (validation !== 'none') {
    return validation;
  }
  return state === 'failed' ? 'failed' : 'none';
}

// One Draft hue, the accent's, wherever a Draft shows (DESIGN.md « State hues »)
const LINE_STATE_CLASS: Record<ArtifactLineState, string> = {
  running: 'text-muted-foreground',
  draft: 'font-medium text-draft-foreground',
  validated: 'text-validated-foreground',
  failed: 'text-destructive',
  none: 'text-muted-foreground',
};

// The titles of the Job Description sit below the Sheet's own sections
const COMPONENT_BY_ELEMENT: Components = { h1: 'h4', h2: 'h4', h3: 'h5', h4: 'h6' };
const REMARK_PLUGIN_LIST = [remarkGfm];

function Section({ title, action, children }: Readonly<{ title: string; action?: ReactNode; children: ReactNode }>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="max-w-none text-label text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ icon, children }: Readonly<{ icon: ReactNode; children: ReactNode }>) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
      </span>
      {children}
    </span>
  );
}

// « 3rd publication of this Position since… », and the Application to an earlier Posting of it with its
// outcome, so that the Candidate does not apply twice blindly; in the Repost's sky (DESIGN.md)
function RepostNotice({ repost }: Readonly<Pick<SheetPosting, 'repost'>>) {
  const { t } = useTranslation('posting');
  const { publicationNumber, firstPublishedAt, earlierApplication } = repost;
  if (earlierApplication === null && publicationNumber <= 1) {
    return null;
  }
  const stepLabel =
    earlierApplication === null ? '' : t(`statusLabelByStatus.${earlierApplication.step}`, { ns: 'common' });
  return (
    <div className="flex gap-2.5 rounded-lg border border-step-applied/30 bg-step-applied/10 px-3 py-2.5 text-sm text-step-applied-foreground">
      <RepeatIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        {publicationNumber > 1 && (
          <p>
            {firstPublishedAt === null
              ? t('sheet.publication', { count: publicationNumber, ordinal: true })
              : t('sheet.publicationSince', { count: publicationNumber, ordinal: true, date: firstPublishedAt })}
          </p>
        )}
        {earlierApplication !== null && (
          <p>
            <Link
              to={`/postings/${earlierApplication.reference}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {earlierApplication.appliedAt === null
                ? t('page.earlierApplicationUndated', { stepLabel })
                : t('page.earlierApplication', { date: earlierApplication.appliedAt, stepLabel })}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function ArtifactLine({
  to,
  icon,
  label,
  state,
  detail,
}: Readonly<{ to: string; icon: ReactNode; label: string; state: ArtifactLineState; detail: string }>) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span aria-hidden className="text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className={cn('flex shrink-0 items-center gap-1.5', LINE_STATE_CLASS[state])}>
        {state === 'running' && <Loader2Icon aria-hidden className="size-3.5 animate-spin" />}
        {state === 'draft' && <span aria-hidden className="size-1.5 rounded-full bg-draft" />}
        {state === 'validated' && <CheckIcon aria-hidden className="size-3.5" />}
        {detail}
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}

function ArtifactLines({ posting, artifactList, interviewList }: Readonly<SheetPosting>) {
  const { t } = useTranslation('posting');
  const page = `/postings/${posting.reference}`;
  const iconByArtifact = { research: <FileSearchIcon />, letter: <PenLineIcon /> };
  return (
    <div className="-mx-2">
      {(['research', 'letter'] as const).map((artifact) => {
        const entry = artifactList.find((candidate) => candidate.artifact === artifact);
        if (entry === undefined) {
          return null;
        }
        const state = lineStateOf(entry);
        return (
          <ArtifactLine
            key={artifact}
            to={`${page}?tab=${artifact}`}
            icon={iconByArtifact[artifact]}
            label={t(`page.tabLabelByTab.${artifact}`)}
            state={state}
            detail={t(`sheet.artifactState.${state}`)}
          />
        );
      })}
      {interviewList.length > 0 && (
        <ArtifactLine
          to={`${page}?tab=interviews`}
          icon={<CalendarDaysIcon />}
          label={t('page.tabLabelByTab.interviews')}
          state="none"
          detail={t('sheet.interviewCount', { count: interviewList.length })}
        />
      )}
    </div>
  );
}

// The body of the Sheet, top to bottom as spec #125 « The Sheet » orders it; its actions and its Notes
// come from its Container
function SheetBody({
  detail,
  actions,
  notes,
}: Readonly<{ detail: SheetPosting; actions: ReactNode; notes: ReactNode }>) {
  const { t } = useTranslation('posting');
  const { posting } = detail;
  return (
    <>
      <SheetHeader className="gap-1.5 border-b px-5 pt-5 pb-4">
        <p className="pr-10 font-mono text-[0.6875rem] text-muted-foreground">{posting.reference}</p>
        <SheetTitle className="max-w-none pr-6 text-title font-semibold text-balance">{posting.title}</SheetTitle>
        <SheetDescription>{posting.employer ?? t('sheet.noEmployer')}</SheetDescription>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
          <Fact icon={<MapPinIcon />}>{posting.city ?? t('unknownCity', { ns: 'lists' })}</Fact>
          <Fact icon={<CalendarClockIcon />}>
            {posting.deadline === null ? t('sheet.noDeadline') : t('sheet.deadline', { date: posting.deadline })}
          </Fact>
          <Fact icon={<CalendarDaysIcon />}>
            {posting.startDate === null ? t('sheet.noStartDate') : t('sheet.startDate', { date: posting.startDate })}
          </Fact>
        </div>
        <div className="pt-1">
          <StepBadge step={posting.step} isArchived={posting.archivedAt !== null} />
        </div>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
        <RepostNotice repost={detail.repost} />
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
        <Section title={t('sheet.documentsHeading')}>
          <ArtifactLines {...detail} />
        </Section>
        <Section
          title={t('contactsHeading')}
          action={
            posting.url !== null && (
              <a
                href={posting.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-label text-primary underline-offset-4 hover:underline"
              >
                {t('page.openOnSource')}
                <ExternalLinkIcon aria-hidden className="size-3" />
              </a>
            )
          }
        >
          <ContactList {...posting} />
        </Section>
        <Section title={t('jobDescriptionHeading')}>
          <div
            // Scrolls on its own: the keyboard reaches it to scroll it
            tabIndex={0}
            className="max-h-80 overflow-y-auto overscroll-contain rounded-lg border bg-muted/30 px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1">
              <ReactMarkdown components={COMPONENT_BY_ELEMENT} remarkPlugins={REMARK_PLUGIN_LIST}>
                {detail.jobDescription}
              </ReactMarkdown>
            </div>
          </div>
        </Section>
        {notes}
      </div>
      <div className="border-t px-5 py-3">
        <Button asChild variant="outline" className="w-full">
          <Link to={`/postings/${posting.reference}`}>
            {t('sheet.openPage')}
            <ArrowUpRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    </>
  );
}

// The side Sheet a list opens on a Posting (spec #125 « The Sheet », DESIGN.md « Layout »): what the
// Candidate needs to decide without leaving the list. Non-modal: the list and the map stay usable, and
// another row or marker shows its Posting in place; only its close button or Escape closes it.
export function PostingSheet({
  detail,
  actions,
  notes,
  onClose,
}: Readonly<{ detail: SheetPosting | null; actions: ReactNode; notes: ReactNode; onClose: () => void }>) {
  return (
    <Sheet
      open={detail !== null}
      modal={false}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 bg-background shadow-sheet data-[side=right]:w-full data-[side=right]:max-sm:border-l-0 data-[side=right]:sm:max-w-[30rem]"
        // The list keeps the focus, so that the Candidate goes on browsing it
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        {detail !== null && <SheetBody detail={detail} actions={actions} notes={notes} />}
      </SheetContent>
    </Sheet>
  );
}

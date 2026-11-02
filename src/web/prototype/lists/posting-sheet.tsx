// PROTOTYPE. The side Sheet a row opens (DECISIONS.md « Lists »): more about the Posting, fast, a few
// actions, no page change. Top to bottom: title, employer, City, Deadline, Start Date, Step; the Repost
// info; the actions of its Step (and Archive); a line per Artifact opening its tab of the Posting page;
// Contacts; the Job Description; the Notes, editable in place; « Ouvrir la page complète ».
// Non-modal: the list and the map stay usable, and another row or point shows its Posting in place.
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileSearchIcon,
  FlagIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PenLineIcon,
  RepeatIcon,
  RotateCcwIcon,
  SendIcon,
  UserRoundIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/web/prototype/components/ui/alert-dialog.tsx';
import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';
import { Separator } from '#/web/prototype/components/ui/separator.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/web/prototype/components/ui/sheet.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import {
  ARTIFACT_STATE_LABEL,
  formatCountdown,
  formatDate,
  formatDateTime,
  STEP_LABEL,
  type IArtifactSummary,
  type IPosting,
} from '../model.ts';
import { useActions, usePosting, useRuns, type IRunView } from '../store.ts';
import { StepBadge } from './cells.tsx';
import { useListController } from './list-context.tsx';
import { ordinal, upcomingInterviewOf, URGENCY_TONE, urgencyOf } from './list-model.ts';

// A button's pending state while its store action answers
function usePending(): [boolean, (action: () => Promise<void>) => Promise<void>] {
  const [isPending, setIsPending] = useState(false);
  async function run(action: () => Promise<void>) {
    setIsPending(true);
    try {
      await action();
    } finally {
      setIsPending(false);
    }
  }
  return [isPending, run];
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      {children}
    </span>
  );
}

function RepostInfo({ posting }: { posting: IPosting }) {
  const { publicationNumber, firstPublishedAt, earlierApplication } = posting.repost;
  if (publicationNumber <= 1 && earlierApplication === null) {
    return null;
  }
  return (
    <div className="flex gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2.5 text-sm">
      <RepeatIcon className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
      <div className="space-y-0.5">
        <p>
          <span className="font-medium">Republication</span> · {ordinal(publicationNumber)} publication de ce poste
          depuis le {formatDate(firstPublishedAt)}
        </p>
        {earlierApplication === null ? null : (
          <p className="text-muted-foreground">
            Tu as postulé le {formatDate(earlierApplication.appliedAt)} · {STEP_LABEL[earlierApplication.step]}
          </p>
        )}
      </div>
    </div>
  );
}

// Marking Applied while the Letter is not validated asks first (as on the Posting page)
function MarkAppliedButton({ posting }: { posting: IPosting }) {
  const actions = useActions();
  const [isPending, run] = usePending();
  const [isAsking, setIsAsking] = useState(false);
  const letter = posting.letter;
  const markApplied = () => run(() => actions.setStatus(posting.reference, 'applied'));
  return (
    <>
      <Button
        disabled={isPending}
        onClick={() => (letter.state === 'validated' ? void markApplied() : setIsAsking(true))}
      >
        {isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        Marquer Postulée
      </Button>
      <AlertDialog open={isAsking} onOpenChange={setIsAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {letter.state === 'draft' ? 'La Lettre est encore un Brouillon' : 'Aucune Lettre pour cette Offre'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {letter.state === 'draft'
                ? `La Version ${String(letter.latestNumber ?? 1)} n’est pas validée. Une fois Postulée, la Lettre est figée.`
                : 'Tu peux marquer l’Offre Postulée sans Lettre ; elle ne pourra plus en avoir ensuite.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="outline" onClick={() => void markApplied()}>
              Marquer Postulée sans Lettre
            </AlertDialogAction>
            {letter.state === 'draft' && letter.latestNumber !== null ? (
              <AlertDialogAction
                onClick={() =>
                  void run(async () => {
                    await actions.validateVersion(posting.reference, 'letter', letter.latestNumber ?? 1);
                    await actions.setStatus(posting.reference, 'applied');
                  })
                }
              >
                Valider la Lettre et marquer Postulée
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OutcomeButtons({ posting }: { posting: IPosting }) {
  const actions = useActions();
  const [isPending, run] = usePending();
  if (posting.status === 'hired' || posting.status === 'rejected') {
    return (
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => void run(() => actions.setStatus(posting.reference, 'applied'))}
      >
        {isPending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
        Remettre en cours
      </Button>
    );
  }
  return (
    <>
      <Button disabled={isPending} onClick={() => void run(() => actions.setStatus(posting.reference, 'hired'))}>
        <FlagIcon />
        Poste obtenu
      </Button>
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => void run(() => actions.setStatus(posting.reference, 'rejected'))}
      >
        <XIcon />
        Refusée
      </Button>
    </>
  );
}

function ArchiveButton({ posting }: { posting: IPosting }) {
  const actions = useActions();
  const [isPending, run] = usePending();
  const [isAsking, setIsAsking] = useState(false);
  if (posting.archivedAt !== null) {
    return (
      <Button
        variant="ghost"
        className="text-muted-foreground"
        disabled={isPending}
        onClick={() => void run(() => actions.unarchive(posting.reference))}
      >
        <ArchiveRestoreIcon />
        Désarchiver
      </Button>
    );
  }
  return (
    <>
      <Button variant="ghost" className="text-muted-foreground" disabled={isPending} onClick={() => setIsAsking(true)}>
        {isPending ? <Loader2Icon className="animate-spin" /> : <ArchiveIcon />}
        Archiver
      </Button>
      <AlertDialog open={isAsking} onOpenChange={setIsAsking}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette Offre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Elle quitte la liste et garde son Étape ; le filtre « Archivées » la retrouve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void run(() => actions.archive(posting.reference))}>
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StepActions({ posting }: { posting: IPosting }) {
  const { sort, leavingReferences } = useListController();
  const isLeaving = leavingReferences.has(posting.reference);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {posting.status === 'new' && posting.archivedAt === null ? (
        <>
          <Button disabled={isLeaving} onClick={() => void sort(posting.reference, 'keep')}>
            {isLeaving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Garder
          </Button>
          <Button variant="outline" disabled={isLeaving} onClick={() => void sort(posting.reference, 'dismiss')}>
            <XIcon />
            Écarter
          </Button>
        </>
      ) : null}
      {posting.status === 'to_apply' ? <MarkAppliedButton posting={posting} /> : null}
      {posting.status !== 'new' && posting.status !== 'to_apply' ? <OutcomeButtons posting={posting} /> : null}
      {posting.status === 'new' && posting.archivedAt === null ? null : (
        <span className="ml-auto">
          <ArchiveButton posting={posting} />
        </span>
      )}
    </div>
  );
}

function ArtifactLine({
  to,
  icon: Icon,
  label,
  summary,
  run,
  detail,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  summary?: IArtifactSummary | undefined;
  run?: IRunView | undefined;
  detail?: string | undefined;
}) {
  let stateText = detail ?? '';
  if (summary !== undefined) {
    stateText =
      summary.state === 'draft'
        ? `Brouillon v${String(summary.latestNumber ?? 1)} · à valider`
        : summary.state === 'validated'
          ? `Validée · v${String(summary.chosenNumber ?? summary.latestNumber ?? 1)}`
          : ARTIFACT_STATE_LABEL.none;
  }
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 font-medium">{label}</span>
      {run === undefined ? (
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 truncate text-muted-foreground',
            summary?.state === 'draft' && 'text-amber-700 dark:text-amber-300',
            summary?.state === 'validated' && 'text-emerald-700 dark:text-emerald-300',
          )}
        >
          {summary?.state === 'validated' ? <CheckIcon className="size-3.5" /> : null}
          {summary?.state === 'draft' ? <span className="size-1.5 rounded-full bg-amber-500" /> : null}
          {stateText}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin text-primary" />
          <span className="truncate">{run.phase}</span>
          <Progress value={run.progress * 100} className="ml-auto w-16" />
        </span>
      )}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ArtifactLines({ posting }: { posting: IPosting }) {
  const runList = useRuns(posting.reference).filter(({ status }) => status === 'running');
  const runOf = (key: string) => runList.find(({ artifactKey }) => artifactKey === key);
  const base = `/prototype/postings/${posting.reference}`;
  const interview = upcomingInterviewOf(posting);
  return (
    <div className="-mx-2">
      <ArtifactLine
        to={`${base}?tab=research`}
        icon={FileSearchIcon}
        label="Recherche"
        summary={posting.research}
        run={runOf('research')}
      />
      <ArtifactLine
        to={`${base}?tab=letter`}
        icon={PenLineIcon}
        label="Lettre"
        summary={posting.letter}
        run={runOf('letter')}
      />
      {posting.interviews.length > 0 ? (
        <ArtifactLine
          to={`${base}?tab=interviews`}
          icon={CalendarDaysIcon}
          label="Entretiens"
          detail={
            interview === null
              ? `${String(posting.interviews.length)} passé${posting.interviews.length > 1 ? 's' : ''} · Portrait, Fiche d’entretien`
              : `Prochain le ${formatDateTime(interview.startAt)}`
          }
        />
      ) : null}
    </div>
  );
}

function Contacts({ posting }: { posting: IPosting }) {
  const { applicationEmail, contact1, contact2, workplace } = posting.contacts;
  const rowList = [
    { icon: MailIcon, value: applicationEmail, href: applicationEmail === null ? null : `mailto:${applicationEmail}` },
    { icon: UserRoundIcon, value: contact1, href: null },
    { icon: UserRoundIcon, value: contact2, href: null },
    { icon: BriefcaseBusinessIcon, value: workplace, href: null },
  ].filter((row) => row.value !== null && row.value.trim() !== '');
  if (rowList.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun contact dans la Fiche de poste.</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {rowList.map(({ icon: Icon, value, href }, index) => (
        <li key={index} className="flex items-start gap-2">
          <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {href === null ? (
            <span className="min-w-0 break-words">{value}</span>
          ) : (
            <a href={href} className="min-w-0 break-all text-primary underline-offset-4 hover:underline">
              {value}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Notes({ posting }: { posting: IPosting }) {
  const actions = useActions();
  const [text, setText] = useState(posting.notes);
  const [isPending, run] = usePending();
  const isDirty = text !== posting.notes;
  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ce que tu veux retenir de cette Offre : un nom, une impression, une question à poser…"
        className="min-h-20 resize-y text-sm"
      />
      {isDirty ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setText(posting.notes)}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => void run(() => actions.saveNotes(posting.reference, text))}
          >
            {isPending ? <Loader2Icon className="animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SheetBody({ posting }: { posting: IPosting }) {
  const urgency = urgencyOf(posting.deadline);
  return (
    <>
      <SheetHeader className="gap-2 border-b px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 pr-8">
          <StepBadge step={posting.step} />
          {posting.archivedAt === null ? null : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <ArchiveIcon />
              Archivée
            </Badge>
          )}
          {posting.isSynthetic ? <Badge>Trouvée à l’instant</Badge> : null}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">{posting.reference}</span>
        </div>
        <SheetTitle className="text-lg leading-snug font-semibold text-balance">{posting.title}</SheetTitle>
        <SheetDescription className="text-sm">{posting.employer ?? 'Employeur non précisé'}</SheetDescription>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
          <Fact icon={MapPinIcon}>
            {posting.city ?? '—'}
            {posting.region === null ? null : <span className="text-muted-foreground">· {posting.region}</span>}
          </Fact>
          <Fact icon={CalendarClockIcon}>
            Date limite {formatDate(posting.deadline)}
            {posting.deadline === null ? null : (
              <span className={cn('text-xs', URGENCY_TONE[urgency].text)}>{formatCountdown(posting.deadline)}</span>
            )}
          </Fact>
          <Fact icon={CalendarDaysIcon}>
            Prise de poste {posting.startDate === null ? 'non précisée' : formatDate(posting.startDate)}
          </Fact>
        </div>
      </SheetHeader>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <RepostInfo posting={posting} />
        <StepActions posting={posting} />
        <Section title="Documents">
          <ArtifactLines posting={posting} />
        </Section>
        <Section
          title="Contacts"
          action={
            posting.url === null ? null : (
              <a
                href={posting.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
              >
                Voir sur {posting.source}
                <ExternalLinkIcon className="size-3" />
              </a>
            )
          }
        >
          <Contacts posting={posting} />
        </Section>
        <Section title="Fiche de poste">
          <div className="max-h-80 overflow-y-auto rounded-lg border bg-muted/30 px-4 py-3">
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-3 prose-headings:mb-0.5 prose-headings:text-[13px] prose-p:my-0.5 first:prose-headings:mt-0">
              <Markdown remarkPlugins={[remarkGfm]}>{posting.jobDescription}</Markdown>
            </div>
          </div>
        </Section>
        <Section title="Notes">
          <Notes key={posting.reference} posting={posting} />
        </Section>
      </div>
      <div className="border-t px-5 py-3">
        <Button asChild variant="outline" className="w-full">
          <Link to={`/prototype/postings/${posting.reference}`}>
            Ouvrir la page complète
            <ArrowUpRightIcon />
          </Link>
        </Button>
      </div>
    </>
  );
}

// Clicks on a row, a point, a toast or the variant switcher keep the Sheet open
const KEEP_OPEN_SELECTOR = '[data-posting-row], .leaflet-container, [data-sonner-toaster], [data-prototype-switcher]';

export function PostingSheet() {
  const { sheetReference, closeSheet } = useListController();
  const posting = usePosting(sheetReference ?? '');
  return (
    <Sheet
      open={sheetReference !== null && posting !== undefined}
      onOpenChange={(isOpen) => !isOpen && closeSheet()}
      modal={false}
    >
      <SheetContent
        side="right"
        className="gap-0 shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-[30rem]"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target instanceof Element && event.target.closest(KEEP_OPEN_SELECTOR) !== null) {
            event.preventDefault();
          }
        }}
      >
        {posting === undefined ? null : <SheetBody posting={posting} />}
      </SheetContent>
    </Sheet>
  );
}

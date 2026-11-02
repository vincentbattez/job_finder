// PROTOTYPE · Posting page agent. The Interviews tab, master-detail (DECISIONS.md « Artifacts »): the
// Interviews on the left (date, place, Interviewers), the selected one on the right with its Tabs
// Fiche d'entretien | Portrait, each an Artifact view; add or edit in a Dialog, delete behind an
// AlertDialog, « Réviser » opens the full-screen Revision. Deep links: ?tab=interviews&interview=1&doc=portrait.
import { CalendarPlusIcon, GraduationCapIcon, MapPinIcon, PencilIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

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
import { Tabs, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import {
  artifactKeyOf,
  nextInterviewOf,
  summaryOf,
  type IInterview,
  type IPosting,
  type IPostingDetail,
} from '../model.ts';
import { useActions } from '../store.ts';
import { ArtifactView } from './artifact-view.tsx';
import { InterviewDialog } from './interview-dialog.tsx';
import type { ReadingVariant } from './reader.tsx';
import { countdownOf, formatLongDay, formatTime, useNow, type ICountdown } from './time.ts';

type Doc = 'brief' | 'portrait';

export function revisionPathOf(reference: string, number: number, variant: string | null): string {
  const query = variant === null || variant === 'A' ? '' : `?variant=${variant}`;
  return `/prototype/postings/${reference}/interviews/${String(number)}/revision${query}`;
}

export function CountdownBadge({ countdown, className }: { countdown: ICountdown; className?: string }) {
  return (
    <Badge
      variant={countdown.moment === 'past' ? 'outline' : 'secondary'}
      className={cn(
        'tabular-nums',
        countdown.moment !== 'past' && countdown.isSoon && 'bg-primary/10 text-primary',
        countdown.moment === 'past' && 'text-muted-foreground',
        className,
      )}
      suppressHydrationWarning
    >
      {countdown.moment === 'past' ? 'passé' : countdown.label}
    </Badge>
  );
}

function StateDot({ state }: { state: 'none' | 'draft' | 'validated' }) {
  return (
    <span
      className={cn(
        'inline-block size-1.5 rounded-full',
        state === 'none' && 'bg-muted-foreground/30',
        state === 'draft' && 'bg-primary',
        state === 'validated' && 'bg-emerald-600 dark:bg-emerald-400',
      )}
    />
  );
}

export function InterviewsTab({
  posting,
  detail,
  variant,
}: {
  posting: IPosting;
  detail: IPostingDetail;
  variant: ReadingVariant;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { deleteInterview } = useActions();
  const now = useNow();
  const [dialog, setDialog] = useState<{ isOpen: boolean; interview: IInterview | null }>({
    isOpen: false,
    interview: null,
  });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const interviewList = posting.interviews.toSorted((first, second) => first.startAt.localeCompare(second.startAt));
  const next = nextInterviewOf(interviewList);
  const requested = Number(searchParams.get('interview'));
  const selected = interviewList.find(({ number }) => number === requested) ?? next ?? interviewList[0];
  const doc: Doc = searchParams.get('doc') === 'portrait' ? 'portrait' : 'brief';

  function select(patch: { interview?: number; doc?: Doc }) {
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        if (patch.interview !== undefined) {
          nextParams.set('interview', String(patch.interview));
        }
        if (patch.doc !== undefined) {
          nextParams.set('doc', patch.doc);
        }
        return nextParams;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  const dialogs = (
    <InterviewDialog
      reference={posting.reference}
      interview={dialog.interview}
      isOpen={dialog.isOpen}
      onOpenChange={(isOpen) => setDialog((previous) => ({ ...previous, isOpen }))}
    />
  );

  if (selected === undefined) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted">
          <CalendarPlusIcon className="size-5 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">Aucun Entretien pour l’instant</h3>
        <p className="mt-1.5 max-w-md text-sm text-balance text-muted-foreground">
          Quand l’employeur te convoque, ajoute l’Entretien : son Portrait et sa Fiche d’entretien se préparent ici, et
          tu pourras le réviser en plein écran.
        </p>
        <Button className="mt-5" size="sm" onClick={() => setDialog({ isOpen: true, interview: null })}>
          <CalendarPlusIcon />
          Ajouter un Entretien
        </Button>
        {dialogs}
      </div>
    );
  }

  const briefKey = artifactKeyOf('interview_brief', selected.number);
  const portraitKey = artifactKeyOf('portrait', selected.number);
  const brief = detail.artifacts.find(({ key }) => key === briefKey);
  const portrait = detail.artifacts.find(({ key }) => key === portraitKey);
  const countdown = countdownOf(selected, now);

  return (
    <div className="@container">
      <div className="grid gap-6 @4xl:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Master */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {interviewList.length} Entretien{interviewList.length > 1 ? 's' : ''}
            </h2>
            <Button variant="ghost" size="xs" onClick={() => setDialog({ isOpen: true, interview: null })}>
              <CalendarPlusIcon />
              Ajouter
            </Button>
          </div>
          <ul className="space-y-2">
            {interviewList.map((interview) => {
              const isSelected = interview.number === selected.number;
              const itemCountdown = countdownOf(interview, now);
              const briefState = summaryOf(
                detail.artifacts.find(({ key }) => key === artifactKeyOf('interview_brief', interview.number)),
              ).state;
              const portraitState = summaryOf(
                detail.artifacts.find(({ key }) => key === artifactKeyOf('portrait', interview.number)),
              ).state;
              return (
                <li key={interview.number}>
                  <button
                    type="button"
                    onClick={() => select({ interview: interview.number })}
                    className={cn(
                      'w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50',
                      isSelected &&
                        'border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20 hover:bg-primary/[0.06]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Entretien {interview.number}</span>
                      <CountdownBadge countdown={itemCountdown} />
                    </div>
                    <p className="mt-1 text-sm first-letter:uppercase">
                      {formatLongDay(interview.startAt)} · {formatTime(interview.startAt)}
                    </p>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPinIcon className="mt-px size-3.5 shrink-0" />
                      <span className="line-clamp-1">{interview.place || '—'}</span>
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <UsersIcon className="mt-px size-3.5 shrink-0" />
                      <span className="line-clamp-2">{interview.interviewers || '—'}</span>
                    </p>
                    <div className="mt-2.5 flex gap-3 border-t pt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <StateDot state={briefState} />
                        Fiche
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <StateDot state={portraitState} />
                        Portrait
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detail */}
        <section className="min-w-0 space-y-5">
          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 basis-72">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold first-letter:uppercase">
                    {formatLongDay(selected.startAt)} à {formatTime(selected.startAt)}
                  </h2>
                  <CountdownBadge countdown={countdown} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Entretien {selected.number} · {selected.durationMinutes} min
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button asChild size="sm">
                  <Link to={revisionPathOf(posting.reference, selected.number, searchParams.get('variant'))}>
                    <GraduationCapIcon />
                    Réviser l’Entretien
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Modifier l’Entretien"
                  onClick={() => setDialog({ isOpen: true, interview: selected })}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer l’Entretien"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <MapPinIcon className="size-4" />
                Lieu
              </dt>
              <dd>{selected.place || '—'}</dd>
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <UsersIcon className="size-4" />
                Interlocuteurs
              </dt>
              <dd className="whitespace-pre-line">{selected.interviewers || '—'}</dd>
            </dl>
          </div>

          <Tabs value={doc} onValueChange={(value) => select({ doc: value as Doc })} className="gap-4">
            <TabsList variant="line" className="w-full justify-start rounded-none border-b">
              <TabsTrigger value="brief" className="flex-none gap-2">
                <StateDot state={summaryOf(brief).state} />
                Fiche d’entretien
              </TabsTrigger>
              <TabsTrigger value="portrait" className="flex-none gap-2">
                <StateDot state={summaryOf(portrait).state} />
                Portrait
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {doc === 'brief' ? (
            <ArtifactView
              key={briefKey}
              posting={posting}
              artifactKey={briefKey}
              type="interview_brief"
              artifact={brief}
              interview={selected}
              variant={variant}
              canFocus
            />
          ) : (
            <ArtifactView
              key={portraitKey}
              posting={posting}
              artifactKey={portraitKey}
              type="portrait"
              artifact={portrait}
              interview={selected}
              variant={variant}
              canFocus
            />
          )}
        </section>
      </div>
      {dialogs}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l’Entretien {selected.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Son Portrait et sa Fiche d’entretien partent avec lui. La Candidature repasse Postulée s’il n’en reste
              aucun.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void deleteInterview(posting.reference, selected.number)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { cn } from 'cn';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  UserRoundSearchIcon,
  UsersIcon,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { findInterviewEnd } from '#/actions/interview-time.ts';
import type { IRevisionSection } from '#/actions/revision-sections.ts';
import { ArtifactText, type ArtifactTextFormat } from '#/web/components/mdx/artifact-text.tsx';
import { Badge } from '#/web/components/ui/badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Progress } from '#/web/components/ui/progress.tsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#/web/components/ui/sheet.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/components/ui/tabs.tsx';

import type { IInterview } from './interviews.tsx';
import { ThemeToggle } from './theme-toggle.tsx';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// The countdown moves by the minute at most
export const TICK_MS = 30_000;

// The documents at hand beside the Revision, in its side Sheet (spec #125, « Reading and Revision »)
const REVISION_SIDE_LIST = ['portrait', 'posting', 'letter'] as const;

export type RevisionSide = (typeof REVISION_SIDE_LIST)[number];

const ICON_BY_SIDE: Record<RevisionSide, ReactNode> = {
  portrait: <UserRoundSearchIcon />,
  posting: <BriefcaseIcon />,
  letter: <MailIcon />,
};

type Moment = 'upcoming' | 'ongoing' | 'past';

// How long until the Interview starts, or since it ended: « 3 j 4 h », « 2 h 05 », « 12 min »
function useCountdown(interview: IInterview, now: number): { moment: Moment; value: string } {
  const { t } = useTranslation('posting');
  const start = interview.startAt.getTime();
  const end = findInterviewEnd(interview).getTime();
  const spell = (ms: number) => {
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
    if (days > 0) {
      return hours === 0 ? t('revision.days', { days }) : t('revision.daysHours', { days, hours });
    }
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
    return hours > 0
      ? t('revision.hoursMinutes', { hours, minutes: String(minutes).padStart(2, '0') })
      : t('revision.minutes', { minutes: Math.max(1, minutes) });
  };
  if (now < start) {
    return { moment: 'upcoming', value: spell(start - now) };
  }
  return now < end ? { moment: 'ongoing', value: '' } : { moment: 'past', value: spell(now - end) };
}

// The Revision's own sticky header, as tall as the page header the reader sticks under (DESIGN.md
// « Revision header »): back to the Interview, the title, the countdown chip and the documents at hand
export function RevisionHeader({
  number,
  postingTitle,
  backTo,
  interview,
  now,
  onOpenSide,
}: Readonly<{
  number: number;
  postingTitle: string;
  backTo: string;
  interview: IInterview;
  now: number;
  onOpenSide: (side: RevisionSide) => void;
}>) {
  const { t } = useTranslation('posting');
  const { moment, value } = useCountdown(interview, now);
  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      <Button asChild variant="ghost" size="icon-sm" aria-label={t('revision.back', { number })}>
        <Link to={backTo}>
          <ArrowLeftIcon />
        </Link>
      </Button>
      <div className="min-w-0 flex-1 py-2">
        <h1 className="max-w-none truncate text-base font-semibold">{t('revision.title', { number })}</h1>
        <p className="truncate text-sm text-muted-foreground">{postingTitle}</p>
      </div>
      <span
        className={cn(
          'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums md:inline-flex',
          moment === 'past' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
      >
        <ClockIcon aria-hidden className="size-3.5" />
        {t(`revision.chip.${moment}`, { value })}
      </span>
      <div className="flex items-center gap-0.5">
        {REVISION_SIDE_LIST.map((side) => {
          return (
            <Button
              key={side}
              variant="ghost"
              size="sm"
              aria-label={t(`revision.side.${side}`)}
              onClick={() => {
                onOpenSide(side);
              }}
            >
              {ICON_BY_SIDE[side]}
              <span aria-hidden className={cn('hidden', side === 'letter' ? 'lg:inline' : 'sm:inline')}>
                {t(`revision.side.${side}`)}
              </span>
            </Button>
          );
        })}
      </div>
      <ThemeToggle />
    </header>
  );
}

// The Interview at a glance and how long is left (DESIGN.md « Revision header »)
export function RevisionHero({ interview, now }: Readonly<{ interview: IInterview; now: number }>) {
  const { t } = useTranslation('posting');
  const { moment, value } = useCountdown(interview, now);
  return (
    <section
      aria-label={t('revision.heroLabel')}
      className="mt-6 grid gap-5 rounded-[18px] border bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div className="min-w-0">
        <p className="text-label tracking-wide text-primary uppercase">
          {t('interviews.facts', { number: interview.number, minutes: interview.durationMinutes })}
        </p>
        <p className="mt-1 text-[1.875rem] leading-tight font-semibold tracking-tight first-letter:uppercase">
          {t('interviews.when', { date: interview.startAt })}
        </p>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <MapPinIcon aria-label={t('interviews.place')} className="mt-0.5 size-4 shrink-0" />
            {interview.place.trim() === '' ? '—' : interview.place}
          </p>
          <p className="flex items-start gap-2">
            <UsersIcon aria-label={t('interviews.interviewers')} className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-2">{interview.interviewers.trim() === '' ? '—' : interview.interviewers}</span>
          </p>
        </div>
      </div>
      <div className="flex items-baseline gap-2 md:flex-col md:items-end md:gap-0 md:text-right">
        <p className="text-[2.25rem] leading-none font-semibold tracking-tight tabular-nums sm:text-display">
          {t(`revision.hero.${moment}`, { value })}
        </p>
        <p className="text-sm text-muted-foreground">{t(`revision.heroNote.${moment}`, { value })}</p>
      </div>
    </section>
  );
}

// How many sections are Mastered out of all, with its bar
export function MasteredCount({ masteredCount, count }: Readonly<{ masteredCount: number; count: number }>) {
  const { t } = useTranslation('posting');
  const label = t('revision.masteredCount', { masteredCount, count });
  return (
    <div className="flex min-w-48 flex-1 items-center gap-3">
      <span className="text-sm font-medium tabular-nums">{label}</span>
      <Progress
        value={count === 0 ? 0 : (masteredCount / count) * 100}
        aria-label={label}
        className="h-1.5 max-w-48 flex-1"
      />
    </div>
  );
}

// A newer Draft waits for validation: the Revision keeps the Chosen Version until then (ADR-0019)
export function DraftBanner({
  draftNumber,
  chosenNumber,
  isReadingDraft,
  readButton,
  validateButton,
}: Readonly<{
  draftNumber: number;
  chosenNumber: number | null;
  isReadingDraft: boolean;
  readButton: ReactNode;
  validateButton: ReactNode;
}>) {
  const { t } = useTranslation('posting');
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-draft/30 bg-draft/[0.05] px-4 py-3 text-sm"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-draft" />
      <span className="min-w-0 flex-1 basis-64">
        <span className="font-medium">
          {isReadingDraft
            ? t('revision.readingDraft', { number: draftNumber })
            : t('revision.draftWaits', { number: draftNumber })}
        </span>{' '}
        <span className="text-muted-foreground">
          {chosenNumber === null ? t('revision.draftNoChosen') : t('revision.draftChosen', { number: chosenNumber })}
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {readButton}
        {validateButton}
      </div>
    </div>
  );
}

// Before any Chosen Interview Brief: where to make one
export function RevisionEmpty({ backTo }: Readonly<{ backTo: string }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="flex flex-col items-center rounded-[18px] border border-dashed px-6 py-16 text-center">
      <h2 className="max-w-none text-base font-semibold">{t('revision.emptyTitle')}</h2>
      <p className="mt-1.5 max-w-md text-sm text-balance text-muted-foreground">{t('revision.emptyDescription')}</p>
      <Button asChild size="sm" className="mt-5">
        <Link to={backTo}>{t('revision.goToInterview')}</Link>
      </Button>
    </div>
  );
}

// The sections a newer Chosen Version no longer has, with what the Candidate left in them
export function VanishedSections({ vanishedList }: Readonly<{ vanishedList: IRevisionSection[] }>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  if (vanishedList.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="mt-6 space-y-2">
      <h3 id={headingId} className="max-w-none text-xs font-medium text-muted-foreground">
        {t('revision.vanished')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('revision.vanishedDescription')}</p>
      <ul className="space-y-2">
        {vanishedList.map(({ title, note, isMastered }) => (
          <li key={title} className="rounded-lg border-l-2 border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs">
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{title}</span>
              {isMastered && (
                <Badge variant="outline" className="text-validated-foreground">
                  <CheckIcon aria-hidden />
                  {t('revision.mastered')}
                </Badge>
              )}
            </span>
            {note.trim() !== '' && <span className="mt-1 block whitespace-pre-line text-muted-foreground">{note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ISideDocument {
  text: string;
  format: ArtifactTextFormat;
}

// The Portrait, the Posting and the Letter at hand, without leaving the Revision
export function RevisionSideSheet({
  side,
  onSideChange,
  documentBySide,
}: Readonly<{
  side: RevisionSide | null;
  onSideChange: (side: RevisionSide | null) => void;
  documentBySide: Record<RevisionSide, ISideDocument | null>;
}>) {
  const { t } = useTranslation('posting');
  return (
    <Sheet
      open={side !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onSideChange(null);
        }
      }}
    >
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('revision.sideTitle')}</SheetTitle>
          <SheetDescription>{t('revision.sideDescription')}</SheetDescription>
        </SheetHeader>
        <Tabs
          value={side ?? 'portrait'}
          onValueChange={(value) => {
            onSideChange(REVISION_SIDE_LIST.find((other) => other === value) ?? null);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList variant="line" className="w-full justify-start rounded-none border-b px-4">
            {REVISION_SIDE_LIST.map((value) => (
              <TabsTrigger key={value} value={value} className="flex-none px-3">
                {t(`revision.side.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {REVISION_SIDE_LIST.map((value) => {
              const document = documentBySide[value];
              return (
                <TabsContent key={value} value={value}>
                  {document === null ? (
                    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      {t(`revision.sideEmpty.${value}`)}
                    </p>
                  ) : (
                    <ArtifactText
                      text={document.text}
                      format={document.format}
                      className="prose-sm prose-neutral prose-headings:max-w-none prose-h1:text-xl prose-h2:text-lg"
                    />
                  )}
                </TabsContent>
              );
            })}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

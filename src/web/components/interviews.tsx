import { cn } from 'cn';
import { CalendarCheck2Icon, CalendarPlusIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { DEFAULT_DURATION_MINUTES } from '#/actions/interview-duration.ts';
import { parisDateTimeOf } from '#/actions/paris-time.ts';
import { Badge } from '#/web/components/ui/badge.tsx';
import { Input } from '#/web/components/ui/input.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

import { StateDot, StateLabel, type TabSummary } from './posting-tabs.tsx';

// An Interview as the actions give it to the Posting page, its start an instant read in Paris time
export interface IInterview {
  number: number;
  startAt: Date;
  durationMinutes: number;
  place: string;
  interviewers: string;
}

// The documents that prepare an Interview, each a tab of the selected one (spec #125, « Interviews »)
export const INTERVIEW_DOCUMENT_LIST = ['interview_brief', 'portrait'] as const;

export type InterviewDocument = (typeof INTERVIEW_DOCUMENT_LIST)[number];

const MINUTE_MS = 60_000;

// The Interview on its Posting page, and its full-screen Revision (spec #125, « Reading and Revision »)
export function interviewPathOf(reference: string, number: number): string {
  return `/postings/${encodeURIComponent(reference)}?tab=interviews&interview=${String(number)}`;
}

export function revisionPathOf(reference: string, number: number): string {
  return `/postings/${encodeURIComponent(reference)}/interviews/${String(number)}/revision`;
}

// Over once its duration has passed
export function isPast({ startAt, durationMinutes }: IInterview, now: number): boolean {
  return startAt.getTime() + durationMinutes * MINUTE_MS <= now;
}

// A place or Interviewers left blank read as a dash
function orDash(text: string): string {
  return text.trim() === '' ? '—' : text;
}

function PlaceLine({ place, className }: Readonly<{ place: string; className?: string }>) {
  const { t } = useTranslation('posting');
  return (
    <p className={cn('flex items-start gap-1.5', className)}>
      <MapPinIcon aria-label={t('interviews.place')} className="mt-px size-3.5 shrink-0" />
      <span className="line-clamp-1">{orDash(place)}</span>
    </p>
  );
}

function InterviewersLine({ interviewers, className }: Readonly<{ interviewers: string; className?: string }>) {
  const { t } = useTranslation('posting');
  return (
    <p className={cn('flex items-start gap-1.5', className)}>
      <UsersIcon aria-label={t('interviews.interviewers')} className="mt-px size-3.5 shrink-0" />
      <span className="line-clamp-2">{orDash(interviewers)}</span>
    </p>
  );
}

// The fields of the Interview Dialog: day and time typed in Paris, duration, place and Interviewers in free
// text; a new Interview starts on the place of the Posting and the default duration
export function InterviewFields({
  interview,
  defaultPlace,
}: Readonly<{ interview: IInterview | null; defaultPlace: string }>) {
  const { t } = useTranslation('posting');
  const id = useId();
  const [day = '', time = ''] = interview === null ? [] : parisDateTimeOf(interview.startAt).split('T');
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-day`}>{t('interviews.day')}</Label>
          <Input id={`${id}-day`} type="date" name="day" required defaultValue={day} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-time`}>{t('interviews.time')}</Label>
          <Input id={`${id}-time`} type="time" name="time" required defaultValue={time} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-duration`}>{t('interviews.duration')}</Label>
          <Input
            id={`${id}-duration`}
            type="number"
            name="durationMinutes"
            min={1}
            required
            className="tabular-nums"
            defaultValue={interview?.durationMinutes ?? DEFAULT_DURATION_MINUTES}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-place`}>{t('interviews.place')}</Label>
        <Input
          id={`${id}-place`}
          name="place"
          placeholder={t('interviews.placePlaceholder')}
          defaultValue={interview?.place ?? defaultPlace}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-interviewers`}>{t('interviews.interviewers')}</Label>
        <Textarea
          id={`${id}-interviewers`}
          name="interviewers"
          placeholder={t('interviews.interviewersPlaceholder')}
          className="min-h-24"
          defaultValue={interview?.interviewers ?? ''}
        />
      </div>
    </div>
  );
}

// The Interview-added step: the Interview as the calendar will show it, then the iCal file and the later choice
export function InterviewAdded({
  interview,
  postingTitle,
  actions,
}: Readonly<{ interview: IInterview; postingTitle: string; actions: ReactNode }>) {
  const { t, i18n } = useTranslation('posting');
  const parts = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
  const partOf = (type: 'day' | 'month') =>
    parts
      .formatToParts(interview.startAt)
      .find((part) => part.type === type)
      ?.value.replace('.', '') ?? '';
  return (
    <div className="grid gap-5">
      <div
        className="flex gap-4 rounded-xl border bg-muted/30 p-4"
        aria-label={t('interviews.title', { number: interview.number })}
      >
        <div
          aria-hidden
          className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border bg-background py-1.5"
        >
          <span className="text-[11px] font-medium text-primary uppercase">{partOf('month')}</span>
          <span className="text-2xl leading-none font-semibold tabular-nums">{partOf('day')}</span>
        </div>
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold first-letter:uppercase">
            {t('interviews.when', { date: interview.startAt })} ·{' '}
            {t('interviews.minutes', { minutes: interview.durationMinutes })}
          </p>
          <p className="line-clamp-1 text-muted-foreground">
            {t('interviews.title', { number: interview.number })} · {postingTitle}
          </p>
          <PlaceLine place={interview.place} className="text-xs text-muted-foreground" />
          <InterviewersLine interviewers={interview.interviewers} className="text-xs text-muted-foreground" />
        </div>
      </div>
      <div className="grid gap-2">{actions}</div>
    </div>
  );
}

// The head of the Interview-added step: a check, its title and what the iCal file brings
export function InterviewAddedIcon() {
  return (
    <div aria-hidden className="mb-1 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
      <CalendarCheck2Icon className="size-6" />
    </div>
  );
}

// Before any Interview: what an Interview brings, and the way to add one; a Posting not Applied has none
export function InterviewsEmpty({ action }: Readonly<{ action: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted">
        <CalendarPlusIcon aria-hidden className="size-5 text-muted-foreground" />
      </div>
      <h2 className="max-w-none text-base font-semibold">{t('interviews.emptyTitle')}</h2>
      <p className="mt-1.5 max-w-md text-sm text-balance text-muted-foreground">
        {action === null ? t('interviews.applyFirst') : t('interviews.emptyDescription')}
      </p>
      {action !== null && <div className="mt-5">{action}</div>}
    </div>
  );
}

function PastBadge({ isShown }: Readonly<{ isShown: boolean }>) {
  const { t } = useTranslation('posting');
  return isShown ? (
    <Badge variant="outline" className="text-muted-foreground">
      {t('interviews.past')}
    </Badge>
  ) : null;
}

// The Interviews by date, each a link that selects it, with its date, place and Interviewers, and the
// state of its documents
export function InterviewList({
  interviewList,
  selectedNumber,
  searchOf,
  summaryOf,
  now,
  addButton,
}: Readonly<{
  interviewList: IInterview[];
  selectedNumber: number;
  // The search of the Posting page that selects an Interview
  searchOf: (number: number) => string;
  summaryOf: (number: number, document: InterviewDocument) => TabSummary;
  now: number;
  addButton: ReactNode;
}>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <nav aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id={headingId} className="max-w-none text-sm font-semibold">
          <span className="sr-only">{t('interviews.listLabel')} · </span>
          {t('interviews.count', { count: interviewList.length })}
        </h2>
        {addButton}
      </div>
      <ul className="space-y-2">
        {interviewList.map((interview) => {
          const isSelected = interview.number === selectedNumber;
          return (
            <li key={interview.number}>
              <Link
                to={{ search: searchOf(interview.number) }}
                replace
                preventScrollReset
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'block rounded-xl border bg-card p-3 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50',
                  isSelected && 'border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20 hover:bg-primary/[0.06]',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t('interviews.title', { number: interview.number })}</span>
                  <PastBadge isShown={isPast(interview, now)} />
                </span>
                <span className="mt-1 block text-sm tabular-nums">
                  {t('interviews.shortWhen', { date: interview.startAt })}
                </span>
                <PlaceLine place={interview.place} className="mt-1.5 text-xs text-muted-foreground" />
                <InterviewersLine
                  interviewers={interview.interviewers}
                  className="mt-1 text-xs text-muted-foreground"
                />
                <span className="mt-2.5 flex gap-3 border-t pt-2 text-[11px] text-muted-foreground">
                  {INTERVIEW_DOCUMENT_LIST.map((document) => (
                    <span key={document} className="inline-flex items-center gap-1.5">
                      <StateDot summary={summaryOf(interview.number, document)} />
                      {t(`artifactLabelByArtifact.${document}`, { ns: 'common' })}
                      <StateLabel summary={summaryOf(interview.number, document)} />
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The selected Interview: its date, its facts, and its actions on the right
export function InterviewSummary({
  interview,
  now,
  actions,
}: Readonly<{ interview: IInterview; now: number; actions: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-whisper sm:p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="max-w-none text-title first-letter:uppercase">
              {t('interviews.when', { date: interview.startAt })}
            </h2>
            <PastBadge isShown={isPast(interview, now)} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('interviews.facts', { number: interview.number, minutes: interview.durationMinutes })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      </div>
      <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <MapPinIcon aria-hidden className="size-4" />
          {t('interviews.place')}
        </dt>
        <dd>{orDash(interview.place)}</dd>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <UsersIcon aria-hidden className="size-4" />
          {t('interviews.interviewers')}
        </dt>
        <dd className="whitespace-pre-line">{orDash(interview.interviewers)}</dd>
      </dl>
    </div>
  );
}

import { cn } from 'cn';
import { CheckCircle2Icon, ChevronDownIcon, CircleAlertIcon, Loader2Icon, XIcon } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { Button } from '#/web/components/ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/components/ui/collapsible.tsx';
import { Progress } from '#/web/components/ui/progress.tsx';
import { NEAR_MISSES_ANCHOR } from '#/web/components/watches.tsx';

export type DetectionOverview = Awaited<ReturnType<Actions['followDetection']>>;
type RecordedDetection = NonNullable<DetectionOverview['last']>;
type DetectionWatch = RecordedDetection['watchList'][number];
type ListsT = ReturnType<typeof useTranslation<'lists'>>['t'];
type CardState = 'running' | 'done' | 'failed';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const ICON_BY_STATE: Record<CardState, ReactNode> = {
  running: <Loader2Icon aria-hidden className="size-4 shrink-0 animate-spin text-primary" />,
  done: <CheckCircle2Icon aria-hidden className="size-4 shrink-0 text-validated-foreground" />,
  failed: <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-destructive" />,
};

// The time now, read again at each interval: the elapsed time and the relative date move on their own
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(interval);
    };
  }, [intervalMs]);
  return now;
}

// "2 hours ago", in the unit that fits, in the locale of the page
function formatRelative(date: Date, now: number, language: string): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const elapsedMs = date.getTime() - now;
  if (Math.abs(elapsedMs) >= DAY_MS) {
    return format.format(Math.round(elapsedMs / DAY_MS), 'day');
  }
  if (Math.abs(elapsedMs) >= HOUR_MS) {
    return format.format(Math.round(elapsedMs / HOUR_MS), 'hour');
  }
  return format.format(Math.round(elapsedMs / MINUTE_MS), 'minute');
}

// The step the Detection is at: that of the last Watch it reached, until the notifications are all sent
function currentStepOf(detection: RecordedDetection | null): DetectionWatch['step'] {
  return detection?.watchList.findLast(({ step }) => step !== 'waiting' && step !== 'done')?.step ?? 'waiting';
}

// The verdict of the whole Detection, which its title says
function headingOf(detection: RecordedDetection, t: ListsT): string {
  if (detection.error !== null) {
    return t('detection.failedHeading');
  }
  const count = detection.watchList.reduce((total, { newPostingList }) => total + newPostingList.length, 0);
  if (count === 0) {
    return t('detection.nothingNewHeading');
  }
  return detection.watchList.every(({ isFirstLaunch }) => isFirstLaunch)
    ? t('detection.firstLaunchHeading', { count })
    : t('detection.newHeading', { count });
}

// The Card under New's header, folding to its one line (DESIGN.md « Cards / Containers »)
function DetectionFrame({
  state,
  heading,
  meta,
  onClose,
  children,
}: Readonly<{
  state: CardState;
  heading: string;
  meta: ReactNode;
  onClose?: (() => void) | undefined;
  children: ReactNode;
}>) {
  const { t } = useTranslation('lists');
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible asChild open={isOpen} onOpenChange={setIsOpen}>
      <section
        aria-labelledby={headingId}
        className={cn(
          'mx-4 my-3 shrink-0 rounded-xl bg-card text-sm shadow-xs ring-1 ring-foreground/10',
          state === 'running' && 'ring-primary/30',
          state === 'failed' && 'ring-destructive/40',
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          {ICON_BY_STATE[state]}
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="max-w-none truncate text-sm font-medium">
              {heading}
            </h2>
            <p className="truncate text-xs text-muted-foreground tabular-nums">{meta}</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={isOpen ? t('detection.fold') : t('detection.unfold')}>
              <ChevronDownIcon aria-hidden className={cn('transition-transform', isOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          {onClose === undefined ? null : (
            <Button variant="ghost" size="icon-sm" aria-label={t('detection.close')} onClick={onClose}>
              <XIcon aria-hidden />
            </Button>
          )}
        </div>
        <CollapsibleContent>
          {/* Short of the list under it, however many Watches */}
          <div className="max-h-[35svh] overflow-y-auto border-t">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function WatchProgress({ watch }: Readonly<{ watch: DetectionWatch }>) {
  const { t } = useTranslation('lists');
  const { label, readCount, readTotal } = watch;
  const step = t(`detection.stepByStep.${watch.step}`);
  const isCounted = readTotal !== null && watch.step === 'reading';
  // Determinate once the Source tells how many Job Descriptions to read: it pulses until then
  const isSearching = watch.step === 'searching';
  const percent = readTotal === null ? 0 : (readCount / Math.max(readTotal, 1)) * 100;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_16rem_8rem]">
      <span className="truncate font-medium">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {step}
        {isCounted && <> {t('detection.readCount', { readCount, readTotal })}</>}
      </span>
      <Progress
        aria-label={step}
        value={watch.step === 'done' ? 100 : percent}
        className={cn(
          'col-span-2 sm:col-span-1',
          isSearching && 'animate-pulse bg-primary/30 motion-reduce:animate-none',
        )}
      />
    </li>
  );
}

function DetectionProgress({ detection }: Readonly<{ detection: RecordedDetection | null }>) {
  const { t } = useTranslation('lists');
  const now = useNow(SECOND_MS);
  const elapsedSeconds =
    detection === null ? 0 : Math.max(0, Math.floor((now - detection.startedAt.getTime()) / SECOND_MS));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsed =
    elapsedMinutes >= 60
      ? t('detection.elapsedHours', { hours: Math.floor(elapsedMinutes / 60), minutes: elapsedMinutes % 60 })
      : t('detection.elapsed', { minutes: elapsedMinutes, seconds: elapsedSeconds % 60 });
  return (
    <DetectionFrame
      state="running"
      heading={detection === null ? t('detection.starting') : t('detection.runningHeading')}
      meta={
        detection === null ? null : (
          <span suppressHydrationWarning>{t('detection.startedAt', { date: detection.startedAt, elapsed })}</span>
        )
      }
    >
      {detection?.watchList.length === 0 && <p className="px-3 py-2">{t('detection.otherCandidate')}</p>}
      <ul className="divide-y">
        {(detection?.watchList ?? []).map((watch) => (
          <WatchProgress key={watch.watchId} watch={watch} />
        ))}
      </ul>
    </DetectionFrame>
  );
}

function watchLineOf(watch: DetectionWatch, t: ListsT): string {
  const { label, newPostingList, readCount, listedCount } = watch;
  if (watch.step === 'waiting') {
    return t('detection.notReached', { label });
  }
  const count = newPostingList.length;
  if (watch.step !== 'done') {
    return t('detection.failedWatch', { label, step: t(`detection.stepByStep.${watch.step}`), readCount, count });
  }
  if (watch.isFirstLaunch) {
    return t('detection.firstLaunch', { label, count });
  }
  return count === 0
    ? t('detection.nothingNew', { label, count: listedCount ?? 0 })
    : t('detection.newPostings', { label, count });
}

function WatchVerdict({ watch }: Readonly<{ watch: DetectionWatch }>) {
  const { t } = useTranslation('lists');
  const { nearMissList, notificationFailureList, locationFailure } = watch;
  return (
    <li className="grid gap-1 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="max-w-none">{watchLineOf(watch, t)}</p>
        {nearMissList.length > 0 && (
          <Link
            to={{ pathname: '/watches', hash: NEAR_MISSES_ANCHOR }}
            className="text-xs text-primary underline-offset-4 hover:underline focus-visible:underline"
          >
            {t('detection.nearMisses', { count: nearMissList.length })}
          </Link>
        )}
      </div>
      {[...notificationFailureList, ...(locationFailure === null ? [] : [locationFailure])].map((failure) => (
        <p key={failure} className="max-w-none text-xs text-destructive">
          {failure}
        </p>
      ))}
    </li>
  );
}

function DetectionVerdict({ detection, onClose }: Readonly<{ detection: RecordedDetection; onClose: () => void }>) {
  const { t, i18n } = useTranslation('lists');
  const now = useNow(MINUTE_MS);
  const date = detection.finishedAt ?? detection.startedAt;
  return (
    <DetectionFrame
      state={detection.error === null ? 'done' : 'failed'}
      heading={headingOf(detection, t)}
      meta={
        <>
          <time dateTime={date.toISOString()} suppressHydrationWarning>
            {formatRelative(date, now, i18n.language)}
          </time>
          {' · '}
          {t(`detection.originByOrigin.${detection.origin}`)}
        </>
      }
      onClose={onClose}
    >
      {detection.error !== null && <p className="max-w-none px-3 py-2 text-destructive">{detection.error}</p>}
      <ul className="divide-y">
        {detection.watchList.map((watch) => (
          <WatchVerdict key={watch.watchId} watch={watch} />
        ))}
      </ul>
    </DetectionFrame>
  );
}

// Under New's header (spec #125 stories 14–17): while any Detection runs, the front's or the daily one,
// its progress, one line per Watch; then its verdict, until closed or the next one starts
export function DetectionCard({
  overview: { running, last },
  isStarting,
  isLastClosed,
  onCloseLast,
}: Readonly<{
  overview: Pick<DetectionOverview, 'running' | 'last'>;
  // Between the click and the reload of the page, the Detection is already starting
  isStarting: boolean;
  isLastClosed: boolean;
  onCloseLast: () => void;
}>) {
  const { t } = useTranslation('lists');
  const isRunning = running !== null || isStarting;
  const shownLast = isLastClosed ? null : last;
  let announcement = '';
  if (isRunning) {
    announcement = t('detection.announceRunning', { step: t(`detection.stepByStep.${currentStepOf(running)}`) });
  } else if (shownLast !== null) {
    announcement = headingOf(shownLast, t);
  }
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {isRunning ? <DetectionProgress detection={running} /> : null}
      {isRunning || shownLast === null ? null : <DetectionVerdict detection={shownLast} onClose={onCloseLast} />}
    </>
  );
}

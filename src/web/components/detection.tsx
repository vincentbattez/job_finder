import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useFetcher } from 'react-router';

import type { IRefusal } from '#/web/failure.ts';

import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

import './detection.css';

interface IDetectedPosting {
  reference: string;
  title: string;
}

// A Watch as the Detection records it, named as the actions name it
interface IDetectionWatch {
  watchId: string;
  label: string;
  step: 'waiting' | 'searching' | 'reading' | 'notifying' | 'done';
  isFirstLaunch: boolean;
  listedCount: number | null;
  readCount: number;
  readTotal: number | null;
  newPostingList: IDetectedPosting[];
  nearMissList: IDetectedPosting[];
  notificationFailureList: string[];
  locationFailure: string | null;
}

export interface IRecordedDetection {
  origin: 'button' | 'automation' | 'cli';
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  watchList: IDetectionWatch[];
}

// The first new Postings the result names: the list below holds them all, marked New
const SHOWN_NEW_POSTING_COUNT = 3;
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

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
function currentStepOf(detection: IRecordedDetection | null): IDetectionWatch['step'] {
  return detection?.watchList.findLast(({ step }) => step !== 'waiting' && step !== 'done')?.step ?? 'waiting';
}

export function DetectionProgress({ detection }: Readonly<{ detection: IRecordedDetection | null }>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  const now = useNow(SECOND_MS);
  const elapsedSeconds =
    detection === null ? 0 : Math.max(0, Math.floor((now - detection.startedAt.getTime()) / SECOND_MS));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsed =
    elapsedMinutes >= 60
      ? t('detection.elapsedHours', { hours: Math.floor(elapsedMinutes / 60), minutes: elapsedMinutes % 60 })
      : t('detection.elapsed', { minutes: elapsedMinutes, seconds: elapsedSeconds % 60 });
  return (
    <section className="detection__panel" data-state="running" aria-labelledby={headingId}>
      <h2 id={headingId} className="detection__heading">
        {detection === null ? t('detection.starting') : t('detection.runningHeading')}
      </h2>
      <p className="detection__meta num" suppressHydrationWarning>
        {elapsed}
      </p>
      {detection?.watchList.length === 0 && <p>{t('detection.otherCandidate')}</p>}
      <ul className="detection__watch-list">
        {(detection?.watchList ?? []).map((watch) => {
          const step = t(`detection.stepByStep.${watch.step}`);
          const isCounted = watch.readTotal !== null && watch.step === 'reading';
          return (
            <li key={watch.watchId} className="detection__watch">
              <span className="detection__label">{watch.label}</span>
              <span className="detection__step">
                {step}
                {isCounted && (
                  <span className="num">
                    {' '}
                    {t('detection.readCount', { readCount: watch.readCount, readTotal: watch.readTotal })}
                  </span>
                )}
              </span>
              {/* Determinate once the Source tells how many Job Descriptions to read, indeterminate before */}
              {watch.readTotal === null ? (
                <progress className="detection__bar" aria-label={step} />
              ) : (
                <progress
                  className="detection__bar"
                  aria-label={step}
                  max={Math.max(watch.readTotal, 1)}
                  value={watch.readTotal === 0 ? 1 : watch.readCount}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// The verdict of the whole Detection, which its title says
function headingOf(detection: IRecordedDetection, t: ReturnType<typeof useTranslation<'posting'>>['t']): string {
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

function WatchVerdict({ watch }: Readonly<{ watch: IDetectionWatch }>) {
  const { t } = useTranslation('posting');
  const { label, newPostingList, nearMissList, notificationFailureList, locationFailure } = watch;
  const count = newPostingList.length;
  let line = t('detection.newPostings', { label, count });
  if (watch.step === 'waiting') {
    line = t('detection.notReached', { label });
  } else if (watch.step !== 'done') {
    line = t('detection.failedWatch', {
      label,
      step: t(`detection.stepByStep.${watch.step}`),
      readCount: watch.readCount,
      count,
    });
  } else if (watch.isFirstLaunch) {
    line = t('detection.firstLaunch', { label, count });
  } else if (count === 0) {
    line = t('detection.nothingNew', { label, count: watch.listedCount ?? 0 });
  }
  return (
    <li className="detection__watch">
      <p>{line}</p>
      {count > 0 && !watch.isFirstLaunch && (
        <>
          <ul className="detection__posting-list">
            {newPostingList.slice(0, SHOWN_NEW_POSTING_COUNT).map(({ reference, title }) => (
              <li key={reference}>
                <Link to={`/postings/${reference}`}>{title}</Link>
              </li>
            ))}
          </ul>
          {/* Without the filters, which could hide them */}
          <Link to={{ pathname: '/', hash: 'posting-list' }}>{t('detection.seeNewPostings')}</Link>
        </>
      )}
      {nearMissList.length > 0 && (
        <details className="detection__near-miss">
          <summary>{t('detection.nearMissSummary', { count: nearMissList.length })}</summary>
          <ul className="detection__posting-list">
            {nearMissList.map(({ reference, title }) => (
              <li key={reference}>
                <span className="num">{reference}</span> {title}
              </li>
            ))}
          </ul>
        </details>
      )}
      {notificationFailureList.map((failure) => (
        <p key={failure} className="detection__error">
          {failure}
        </p>
      ))}
      {locationFailure !== null && <p className="detection__error">{locationFailure}</p>}
    </li>
  );
}

export function DetectionResult({ detection }: Readonly<{ detection: IRecordedDetection }>) {
  const { t, i18n } = useTranslation('posting');
  const headingId = useId();
  const now = useNow(MINUTE_MS);
  const date = detection.finishedAt ?? detection.startedAt;
  return (
    <section
      className="detection__panel"
      data-state={detection.error === null ? 'done' : 'failed'}
      aria-labelledby={headingId}
    >
      <p className="detection__eyebrow">{t('detection.lastHeading')}</p>
      <h2 id={headingId} className="detection__heading">
        {headingOf(detection, t)}
      </h2>
      <p className="detection__meta">
        <time dateTime={date.toISOString()} suppressHydrationWarning>
          {t('detection.when', { relative: formatRelative(date, now, i18n.language), date })}
        </time>
        {' · '}
        {t(`detection.originByOrigin.${detection.origin}`)}
      </p>
      {detection.error !== null && <p className="detection__error">{detection.error}</p>}
      <ul className="detection__watch-list">
        {detection.watchList.map((watch) => (
          <WatchVerdict key={watch.watchId} watch={watch} />
        ))}
      </ul>
    </section>
  );
}

// Runs a Detection of the Candidate's Watches without waiting for the daily one. While any Detection
// runs, the front's or the daily one, its progress replaces the button and the page reads it again;
// then its verdict stays, as the last Detection, until the next one (#63).
export function Detection({
  overview,
}: Readonly<{ overview: { running: IRecordedDetection | null; last: IRecordedDetection | null } }>) {
  const fetcher = useFetcher<IRefusal>();
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('posting');
  const panelReference = useRef<HTMLDivElement>(null);
  const { running, last } = overview;
  // Between the click and the reload of the page, the Detection is already starting
  const isRunning = running !== null || fetcher.state !== 'idle';
  useRevalidateWhile(running !== null);
  let announcement = '';
  if (isRunning) {
    announcement = t('detection.announceRunning', { step: t(`detection.stepByStep.${currentStepOf(running)}`) });
  } else if (last !== null) {
    announcement = headingOf(last, t);
  }
  return (
    // Focused when the button that started it goes away, so the focus stays on the page
    <div className="detection" ref={panelReference} tabIndex={-1}>
      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
      {isRunning ? (
        <DetectionProgress detection={running} />
      ) : (
        <>
          <fetcher.Form
            method="post"
            action="/detect"
            onSubmit={() => {
              panelReference.current?.focus();
            }}
          >
            <button className="button button--primary" type="submit" disabled={!isHydrated}>
              {last?.error == null ? t('detection.run') : t('detection.runAgain')}
            </button>
          </fetcher.Form>
          {fetcher.data?.error != null && (
            <p role="alert" className="detection__error">
              {fetcher.data.error}
            </p>
          )}
          {last === null ? (
            <p className="detection__meta">{t('detection.never')}</p>
          ) : (
            <DetectionResult detection={last} />
          )}
        </>
      )}
    </div>
  );
}

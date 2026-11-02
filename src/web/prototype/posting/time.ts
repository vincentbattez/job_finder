// PROTOTYPE · Posting page agent. Time of the Interviews: a ticking clock, a countdown to the minute,
// and the Paris date and time a form edits.
import { useEffect, useState } from 'react';

import type { IInterview } from '../model.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// The current time, again every `intervalMs`
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

export type InterviewMoment = 'upcoming' | 'ongoing' | 'past';

export interface ICountdown {
  moment: InterviewMoment;
  // « 2 h 05 », « 3 j 4 h », « 12 min »
  value: string;
  // « dans 2 h 05 », « en cours », « il y a 3 j »
  label: string;
  isSoon: boolean;
}

function spell(ms: number): string {
  if (ms >= DAY_MS) {
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
    return hours === 0 ? `${String(days)} j` : `${String(days)} j ${String(hours)} h`;
  }
  if (ms >= HOUR_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
    return `${String(hours)} h ${String(minutes).padStart(2, '0')}`;
  }
  return `${String(Math.max(1, Math.ceil(ms / MINUTE_MS)))} min`;
}

export function countdownOf(interview: Pick<IInterview, 'startAt' | 'durationMinutes'>, now: Date): ICountdown {
  const start = new Date(interview.startAt).getTime();
  const end = start + interview.durationMinutes * MINUTE_MS;
  const time = now.getTime();
  if (time < start) {
    const value = spell(start - time);
    return { moment: 'upcoming', value, label: `dans ${value}`, isSoon: start - time < DAY_MS };
  }
  if (time < end) {
    return { moment: 'ongoing', value: 'en cours', label: 'en cours', isSoon: true };
  }
  const value = spell(time - end);
  return { moment: 'past', value, label: `il y a ${value}`, isSoon: false };
}

const PARIS_PARTS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// « 2026-11-02 » and « 16:30 », in Paris time
export function parisParts(iso: string): { date: string; time: string } {
  const [date = '', time = ''] = PARIS_PARTS.format(new Date(iso)).split(' ');
  return { date, time };
}

// The instant of a Paris date and time: the offset Paris has on that day
export function fromParis(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const shown = parisParts(guess.toISOString());
  const shownAsUtc = new Date(`${shown.date}T${shown.time}:00Z`).getTime();
  return new Date(guess.getTime() - (shownAsUtc - guess.getTime())).toISOString();
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

// « lundi 2 novembre »
export function formatLongDay(iso: string): string {
  return WEEKDAY_FORMAT.format(new Date(iso));
}

// « 16:30 »
export function formatTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso));
}

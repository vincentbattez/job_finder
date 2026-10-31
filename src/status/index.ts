import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import type { Interview, Locale, Posting, Status, Step } from '#/domain/index.ts';

// What the status rules read of a Posting
type PostingStatus = Pick<Posting, 'reference' | 'status' | 'appliedAt'>;

// A calendar day in France, as « 2026-11-20 », so that two days compare as strings
const FRANCE_DAY_FORMAT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });

// The last day to apply: the Deadline, else the publication date plus the default delay of the
// config (GLOSSARY.md « Deadline »). The Source gives the Deadline as a day, at midnight UTC.
function findLastDay(
  { deadline, publishedAt }: Pick<Posting, 'deadline' | 'publishedAt'>,
  defaultDelayMonths: number,
): string | undefined {
  if (deadline !== null) {
    return deadline.toISOString().slice(0, 'AAAA-MM-JJ'.length);
  }
  if (publishedAt === null) {
    return undefined;
  }
  const lastDay = new Date(publishedAt);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + defaultDelayMonths);
  return FRANCE_DAY_FORMAT.format(lastDay);
}

// Computed, never stored, since it depends on the day; a Posting without any date never expires
export function isExpired(
  posting: Pick<Posting, 'deadline' | 'publishedAt'>,
  now: Date,
  defaultDelayMonths: number,
): boolean {
  const lastDay = findLastDay(posting, defaultDelayMonths);
  return lastDay !== undefined && FRANCE_DAY_FORMAT.format(now) > lastDay;
}

const MINUTE_MS = 60_000;

// Taken place once its start plus its duration has passed: an Interview in progress is still to come
function hasTakenPlace({ startAt, durationMinutes }: Pick<Interview, 'startAt' | 'durationMinutes'>, now: Date) {
  return startAt.getTime() + durationMinutes * MINUTE_MS <= now.getTime();
}

// Computed, never stored, since it depends on the time (ADR-0009): an outcome wins over the Interviews,
// and an Application with none stays Applied
export function findStep(
  { status }: Pick<Posting, 'status'>,
  interviewList: readonly Pick<Interview, 'startAt' | 'durationMinutes'>[],
  now: Date,
): Step {
  if (status !== 'applied' || interviewList.length === 0) {
    return status;
  }
  return interviewList.every((interview) => hasTakenPlace(interview, now)) ? 'interviewed' : 'invited';
}

// Applied once, even if Archived since: the Candidate sent its Chosen Letter, and its Application
// started. A Posting Applied before appliedAt existed has none.
export function hasBeenApplied({ status, appliedAt }: Pick<Posting, 'status' | 'appliedAt'>): boolean {
  return status !== 'to_apply' || appliedAt !== null;
}

// When a Posting moving to the status was first Applied: its Chosen Letter, the one sent, stays
// frozen from then on
export function findAppliedAt(posting: Pick<Posting, 'status' | 'appliedAt'>, status: Status, now: Date): Date | null {
  return posting.appliedAt ?? (status !== 'to_apply' || hasBeenApplied(posting) ? now : null);
}

// The outcomes of an Application, In progress being Applied: the Candidate moves freely between them
const APPLICATION_STATUS_LIST: Status[] = ['applied', 'hired', 'rejected'];

// What the outcome selector offers besides the Status the Posting has, Archived or not (ADR-0007):
// Applied on a To Apply Posting, then the other outcomes of its Application. Applied is never undone,
// since the Chosen Letter was sent.
export function listStatusChoices(posting: Pick<Posting, 'status' | 'appliedAt'>): Status[] {
  return hasBeenApplied(posting) ? APPLICATION_STATUS_LIST.filter((status) => status !== posting.status) : ['applied'];
}

// Moving to the status it already has changes nothing
export function assertStatusChange(posting: PostingStatus, status: Status, locale: Locale): void {
  const choiceList = listStatusChoices(posting);
  if (status === posting.status || choiceList.includes(status)) {
    return;
  }
  if (hasBeenApplied(posting)) {
    throw codedError('status_change_after_applied', { reference: posting.reference }, { locale });
  }
  const t = tFor(locale, 'error');
  const tCommon = tFor(locale, 'common');
  const nextLabelList = choiceList.map((choice) => tCommon(`statusLabelByStatus.${choice}`));
  const values = {
    reference: posting.reference,
    statusLabel: tCommon(`statusLabelByStatus.${posting.status}`),
    nextLabels: nextLabelList.join(t('orSeparator')),
  };
  throw codedError('status_change', values, { locale });
}

// Once the Posting was Applied, the Chosen Letter is the one sent, even once the Posting is Archived
export function findLetterFreeze(posting: PostingStatus, locale: Locale): string | undefined {
  return hasBeenApplied(posting) ? tFor(locale, 'error')('letterFrozen', { reference: posting.reference }) : undefined;
}

// Every action that would change the Chosen Letter calls this first
export function assertLetterModifiable(posting: PostingStatus, locale: Locale): void {
  if (hasBeenApplied(posting)) {
    throw codedError('letter_frozen', { reference: posting.reference }, { locale });
  }
}

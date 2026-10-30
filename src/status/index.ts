import { catalogueOf } from '#/domain/catalogue/index.ts';
import type { Posting, Status } from '#/domain/index.ts';

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

// Applied once, even if Archived since: the Candidate sent its Chosen Letter. A Posting Applied
// before appliedAt existed has none.
export function hasBeenApplied({ status, appliedAt }: Pick<Posting, 'status' | 'appliedAt'>): boolean {
  return status === 'applied' || appliedAt !== null;
}

// When a Posting moving to the status was first Applied: its Chosen Letter, the one sent, stays
// frozen from then on
export function findAppliedAt(posting: Pick<Posting, 'status' | 'appliedAt'>, status: Status, now: Date): Date | null {
  return posting.appliedAt ?? (status === 'applied' || hasBeenApplied(posting) ? now : null);
}

// The statuses a Posting can move to. Applied is never undone, since the Chosen Letter was sent: a
// Applied Posting can be Archived, and comes back from Archived as Applied, never To Apply.
export function listNextStatuses(posting: Pick<Posting, 'status' | 'appliedAt'>): Status[] {
  switch (posting.status) {
    case 'to_apply': {
      return ['applied', 'archived'];
    }
    case 'applied': {
      return ['archived'];
    }
    case 'archived': {
      return [hasBeenApplied(posting) ? 'applied' : 'to_apply'];
    }
  }
}

// Moving to the status it already has changes nothing
export function assertStatusChange(posting: PostingStatus, status: Status): void {
  const nextStatusList = listNextStatuses(posting);
  if (status === posting.status || nextStatusList.includes(status)) {
    return;
  }
  // In French, as the rest of the message, until it speaks the Candidate's locale (#74)
  const { statusLabelByStatus } = catalogueOf(null).common;
  const nextLabelList = nextStatusList.map((nextStatus) => statusLabelByStatus[nextStatus]);
  const reason = hasBeenApplied(posting) ? ", Postulée ne s'annulant jamais : sa Lettre retenue est celle envoyée" : '';
  throw new Error(
    `L'Offre ${posting.reference} est ${statusLabelByStatus[posting.status]} : elle ne peut passer qu'en ${nextLabelList.join(' ou ')}${reason}.`,
  );
}

// Once the Posting was Applied, the Chosen Letter is the one sent, even once the Posting is Archived
export function findLetterFreeze(posting: PostingStatus): string | undefined {
  return hasBeenApplied(posting)
    ? `L'Offre ${posting.reference} a été Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.`
    : undefined;
}

// Every action that would change the Chosen Letter calls this first
export function assertLetterModifiable(posting: PostingStatus): void {
  const freeze = findLetterFreeze(posting);
  if (freeze !== undefined) {
    throw new Error(freeze);
  }
}

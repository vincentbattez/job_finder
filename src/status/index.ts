import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import type { Interview, Locale, Posting, Status, Step } from '#/domain/index.ts';
import { hasTakenPlace } from '#/domain/interview-time.ts';
import { PARIS_DAY_FORMAT } from '#/domain/paris-time.ts';

// What the status rules read of a Posting
type PostingStatus = Pick<Posting, 'reference' | 'status' | 'appliedAt'>;

// What the Status choices read of a Posting: an Interview proves its Letter was sent
type PostingWithInterview = Pick<Posting, 'status' | 'appliedAt'> & { hasInterview: boolean };

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
  return PARIS_DAY_FORMAT.format(lastDay);
}

// Computed, never stored, since it depends on the day; a Posting without any date never expires
export function isExpired(
  posting: Pick<Posting, 'deadline' | 'publishedAt'>,
  now: Date,
  defaultDelayMonths: number,
): boolean {
  const lastDay = findLastDay(posting, defaultDelayMonths);
  return lastDay !== undefined && PARIS_DAY_FORMAT.format(now) > lastDay;
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
// New, not sorted yet, is never Applied, like To Apply.
export function hasBeenApplied({ status, appliedAt }: Pick<Posting, 'status' | 'appliedAt'>): boolean {
  return (status !== 'new' && status !== 'to_apply') || appliedAt !== null;
}

// When a Posting moving to the status was first Applied: its Chosen Letter, the one sent, stays
// frozen from then on. Back to To Apply, it was never sent: the Application never started.
export function findAppliedAt(posting: Pick<Posting, 'status' | 'appliedAt'>, status: Status, now: Date): Date | null {
  return status === 'to_apply' ? null : (posting.appliedAt ?? now);
}

// The outcomes of an Application, In progress being Applied: the Candidate moves freely between them
const APPLICATION_STATUS_LIST: Status[] = ['applied', 'hired', 'rejected'];

// What the outcome selector offers besides the Status the Posting has, Archived or not (ADR-0007):
// nothing on a New Posting, which is kept or dismissed instead (ADR-0018), Applied on a To Apply Posting, then the other outcomes of its Application. An Applied Posting goes
// back to To Apply when its Letter was never sent; an outcome or an Interview proves it was.
export function listStatusChoices(posting: PostingWithInterview): Status[] {
  if (posting.status === 'new') {
    return [];
  }
  if (!hasBeenApplied(posting)) {
    return ['applied'];
  }
  const outcomeList = APPLICATION_STATUS_LIST.filter((status) => status !== posting.status);
  return posting.status === 'applied' && !posting.hasInterview ? ['to_apply', ...outcomeList] : outcomeList;
}

// Moving to the status it already has changes nothing
export function assertStatusChange(
  posting: PostingStatus & PostingWithInterview,
  status: Status,
  locale: Locale,
): void {
  const choiceList = listStatusChoices(posting);
  if (status === posting.status || choiceList.includes(status)) {
    return;
  }
  if (posting.status === 'new') {
    throw codedError('new_not_sorted', { reference: posting.reference }, { locale });
  }
  if (status === 'to_apply' && hasBeenApplied(posting)) {
    const code = posting.status === 'applied' ? 'to_apply_with_interview' : 'to_apply_after_outcome';
    throw codedError(code, { reference: posting.reference }, { locale });
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

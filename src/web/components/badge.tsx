import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import type { State } from '#/actions/state.ts';

import './badge.css';

// The stored Status, as the actions give it
export type Status = Awaited<ReturnType<Actions['listPostings']>>[number]['status'];

// The Status as the actions compute it, Invited or Interviewed from the Interviews (ADR-0009)
export type Step = Awaited<ReturnType<Actions['listPostings']>>[number]['step'];

// What the badge and the map read of a Posting
interface IShownPosting {
  step: Step;
  isExpired: boolean;
  archivedAt: Date | null;
  unpublishedAt: Date | null;
}

// Expired comes from the Deadline, whatever the status (GLOSSARY.md). The badge and the map
// show it only in place of To Apply: an Applied Posting stays green past its Deadline.
function showStatus({ step, isExpired }: Pick<IShownPosting, 'step' | 'isExpired'>): Step | 'expired' {
  return step === 'to_apply' && isExpired ? 'expired' : step;
}

// Archived is a mark beside the Status, which it keeps (ADR-0007): its own badge, next to the Status one
function ArchivedBadge() {
  const { t } = useTranslation();
  return (
    <span className="badge" data-archived="">
      {t('archived')}
    </span>
  );
}

// Unpublished is a mark beside the Status too, which it keeps: its own badge, in the look of Archived
function UnpublishedBadge() {
  const { t } = useTranslation();
  return (
    <span className="badge" data-unpublished="">
      {t('unpublished')}
    </span>
  );
}

export function StatusBadge(posting: Readonly<IShownPosting>) {
  const { t } = useTranslation();
  const shownStatus = showStatus(posting);
  return (
    <>
      <span className="badge" data-status={shownStatus}>
        {shownStatus === 'expired' ? t(shownStatus) : t(`statusLabelByStatus.${shownStatus}`)}
      </span>
      {posting.archivedAt !== null && <ArchivedBadge />}
      {posting.unpublishedAt !== null && <UnpublishedBadge />}
    </>
  );
}

export { type State } from '#/actions/state.ts';

export function StateBadge({ state }: Readonly<{ state: State }>) {
  const { t } = useTranslation('posting');
  return (
    <span className="badge" data-state={state}>
      {t(`stateLabelByState.${state}`)}
    </span>
  );
}

// Any other badge, such as whose Instructions a module follows: its data attributes give its tint
export function Badge(properties: Readonly<Omit<ComponentProps<'span'>, 'className'>>) {
  return <span {...properties} className="badge" />;
}

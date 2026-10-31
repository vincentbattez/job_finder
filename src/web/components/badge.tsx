import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import type { State } from '#/actions/state.ts';

import './badge.css';

// The statuses as the actions give them
export type Status = Awaited<ReturnType<Actions['listPostings']>>[number]['status'];

// What the badge and the map read of a Posting
interface IShownPosting {
  status: Status;
  isExpired: boolean;
  archivedAt: Date | null;
}

// Expired comes from the Deadline, whatever the status (GLOSSARY.md). The badge and the map
// show it only in place of To Apply: an Applied Posting stays green past its Deadline. Archived is a
// mark beside the Status (ADR-0007): shown in its place while it lasts, the Status back once unarchived.
export function showStatus({ status, isExpired, archivedAt }: IShownPosting): Status | 'expired' | 'archived' {
  if (archivedAt !== null) {
    return 'archived';
  }
  return status === 'to_apply' && isExpired ? 'expired' : status;
}

export function StatusBadge(posting: Readonly<IShownPosting>) {
  const { t } = useTranslation();
  const shownStatus = showStatus(posting);
  return (
    <span className="badge" data-status={shownStatus}>
      {shownStatus === 'expired' || shownStatus === 'archived'
        ? t(shownStatus)
        : t(`statusLabelByStatus.${shownStatus}`)}
    </span>
  );
}

export { STATE_LIST, type State } from '#/actions/state.ts';

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

import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';

// The statuses as the actions give them
export type Status = Awaited<ReturnType<Actions['listPostings']>>[number]['status'];

// Expired comes from the Deadline, whatever the status (GLOSSARY.md). The badge and the map
// show it only in place of To Apply: an Applied Posting stays green past its Deadline.
export function showStatus(status: Status, isExpired: boolean): Status | 'expired' {
  return status === 'to_apply' && isExpired ? 'expired' : status;
}

export function StatusBadge({ status, isExpired }: Readonly<{ status: Status; isExpired: boolean }>) {
  const { t } = useTranslation();
  const shownStatus = showStatus(status, isExpired);
  return (
    <span className="badge" data-status={shownStatus}>
      {shownStatus === 'expired' ? t('expired') : t(`statusLabelByStatus.${shownStatus}`)}
    </span>
  );
}

export const STATE_LIST = ['absent', 'in_progress', 'ready', 'failed'] as const;

export type State = (typeof STATE_LIST)[number];

export function StateBadge({ state }: Readonly<{ state: State }>) {
  const { t } = useTranslation('posting');
  return (
    <span className="badge" data-state={state}>
      {t(`stateLabelByState.${state}`)}
    </span>
  );
}

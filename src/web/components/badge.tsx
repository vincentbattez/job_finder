import type { Catalogue } from '#/actions/catalogue.ts';
import { useCatalogue } from '#/web/catalogue.ts';

// The statuses as the catalogue names them
export type Status = keyof Catalogue['common']['statusLabelByStatus'];

// Expired comes from the Deadline, whatever the status (GLOSSARY.md). The badge and the map
// show it only in place of To Apply: an Applied Posting stays green past its Deadline.
export function showStatus(status: Status, isExpired: boolean): Status | 'expired' {
  return status === 'to_apply' && isExpired ? 'expired' : status;
}

export function StatusBadge({ status, isExpired }: Readonly<{ status: Status; isExpired: boolean }>) {
  const { common } = useCatalogue();
  const shownStatus = showStatus(status, isExpired);
  return (
    <span className="badge" data-status={shownStatus}>
      {shownStatus === 'expired' ? common.expired : common.statusLabelByStatus[shownStatus]}
    </span>
  );
}

export const STATE_LIST = ['absent', 'in_progress', 'ready', 'failed'] as const;

export type State = (typeof STATE_LIST)[number];

const STATE_LABEL_BY_STATE: Record<State, string> = {
  absent: 'Absent',
  in_progress: 'En cours',
  ready: 'Prêt',
  failed: 'En échec',
};

export function StateBadge({ state }: Readonly<{ state: State }>) {
  return (
    <span className="badge" data-state={state}>
      {STATE_LABEL_BY_STATE[state]}
    </span>
  );
}

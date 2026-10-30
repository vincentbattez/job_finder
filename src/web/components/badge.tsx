import { STATUS_LABEL_BY_STATUS } from '#/actions/labels.ts';

// The statuses as the actions name them
export type Status = keyof typeof STATUS_LABEL_BY_STATUS;

const SHOWN_STATUS_LABEL_BY_STATUS: Record<Status | 'expired', string> = {
  ...STATUS_LABEL_BY_STATUS,
  expired: 'Expirée',
};

// Expired comes from the Deadline, whatever the status (GLOSSARY.md). The badge and the map
// show it only in place of To Apply: an Applied Posting stays green past its Deadline.
export function showStatus(status: Status, isExpired: boolean): Status | 'expired' {
  return status === 'to_apply' && isExpired ? 'expired' : status;
}

export function StatusBadge({ status, isExpired }: Readonly<{ status: Status; isExpired: boolean }>) {
  const shownStatus = showStatus(status, isExpired);
  return (
    <span className="badge" data-status={shownStatus}>
      {SHOWN_STATUS_LABEL_BY_STATUS[shownStatus]}
    </span>
  );
}

export const ETAT_LIST = ['absent', 'en_cours', 'pret', 'en_echec'] as const;

export type Etat = (typeof ETAT_LIST)[number];

const ETAT_LABEL_BY_ETAT: Record<Etat, string> = {
  absent: 'Absent',
  en_cours: 'En cours',
  pret: 'Prêt',
  en_echec: 'En échec',
};

export function EtatBadge({ etat }: Readonly<{ etat: Etat }>) {
  return (
    <span className="badge" data-etat={etat}>
      {ETAT_LABEL_BY_ETAT[etat]}
    </span>
  );
}

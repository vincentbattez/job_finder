export const STATUT_LIST = ['a_traiter', 'postulee', 'expiree', 'archivee'] as const;

export type Statut = (typeof STATUT_LIST)[number];

const STATUT_LABEL_BY_STATUT: Record<Statut, string> = {
  a_traiter: 'À traiter',
  postulee: 'Postulée',
  expiree: 'Expirée',
  archivee: 'Archivée',
};

export function StatutBadge({ statut }: Readonly<{ statut: Statut }>) {
  return (
    <span className="badge" data-statut={statut}>
      {STATUT_LABEL_BY_STATUT[statut]}
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

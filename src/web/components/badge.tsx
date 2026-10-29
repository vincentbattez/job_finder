export type Statut = 'a_traiter' | 'postulee' | 'archivee';

const STATUT_LABEL_BY_STATUT: Record<Statut | 'expiree', string> = {
  a_traiter: 'À traiter',
  postulee: 'Postulée',
  expiree: 'Expirée',
  archivee: 'Archivée',
};

// Expirée comes from the Date limite, whatever the statut (GLOSSARY.md). Like the map of issue
// #20, the badge shows it only in place of À traiter: a Postulée Offre stays green past its
// Date limite.
export function StatutBadge({ statut, isExpiree }: Readonly<{ statut: Statut; isExpiree: boolean }>) {
  const shownStatut = statut === 'a_traiter' && isExpiree ? 'expiree' : statut;
  return (
    <span className="badge" data-statut={shownStatut}>
      {STATUT_LABEL_BY_STATUT[shownStatut]}
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

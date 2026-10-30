import { STATUT_LABEL_BY_STATUT } from '#/actions/labels.ts';

// The statuts as the actions name them
export type Statut = keyof typeof STATUT_LABEL_BY_STATUT;

const SHOWN_STATUT_LABEL_BY_STATUT: Record<Statut | 'expiree', string> = {
  ...STATUT_LABEL_BY_STATUT,
  expiree: 'Expirée',
};

// Expirée comes from the Date limite, whatever the statut (GLOSSARY.md). The badge and the map
// show it only in place of À traiter: a Postulée Offre stays green past its Date limite.
export function showStatut(statut: Statut, isExpiree: boolean): Statut | 'expiree' {
  return statut === 'a_traiter' && isExpiree ? 'expiree' : statut;
}

export function StatutBadge({ statut, isExpiree }: Readonly<{ statut: Statut; isExpiree: boolean }>) {
  const shownStatut = showStatut(statut, isExpiree);
  return (
    <span className="badge" data-statut={shownStatut}>
      {SHOWN_STATUT_LABEL_BY_STATUT[shownStatut]}
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

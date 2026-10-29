import type { Artefact, Statut } from './index.ts';

// How the CLI, the front and the messages name each Artefact and each statut (GLOSSARY.md)
export const ARTEFACT_LABEL_BY_ARTEFACT: Record<Artefact, string> = {
  recherche: 'Recherche',
  lettre: 'Lettre',
  fiche_entretien: 'Fiche d’entretien',
  visualisation: 'Visualisation',
};

export const STATUT_LABEL_BY_STATUT: Record<Statut, string> = {
  a_traiter: 'À traiter',
  postulee: 'Postulée',
  archivee: 'Archivée',
};

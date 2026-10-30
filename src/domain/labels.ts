import type { Artefact, Status } from './index.ts';

// How the CLI, the front and the messages name each Artefact and each status (GLOSSARY.md)
export const ARTEFACT_LABEL_BY_ARTEFACT: Record<Artefact, string> = {
  recherche: 'Recherche',
  lettre: 'Lettre',
  fiche_entretien: 'Fiche d’entretien',
  visualisation: 'Visualisation',
};

export const STATUS_LABEL_BY_STATUS: Record<Status, string> = {
  to_apply: 'À traiter',
  applied: 'Postulée',
  archived: 'Archivée',
};

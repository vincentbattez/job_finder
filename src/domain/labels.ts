import type { Artifact, Status } from './index.ts';

// How the CLI, the front and the messages name each Artifact and each status (GLOSSARY.md)
export const ARTIFACT_LABEL_BY_ARTIFACT: Record<Artifact, string> = {
  research: 'Recherche',
  letter: 'Lettre',
  interview_brief: 'Fiche d’entretien',
  visualization: 'Visualisation',
};

export const STATUS_LABEL_BY_STATUS: Record<Status, string> = {
  to_apply: 'À traiter',
  applied: 'Postulée',
  archived: 'Archivée',
};

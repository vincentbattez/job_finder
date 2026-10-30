import type { COMMON_EN } from '#/domain/catalogue/en/common.ts';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: 'Europe/Paris' });

export const COMMON_FR: typeof COMMON_EN = {
  statusLabelByStatus: {
    to_apply: 'À traiter',
    applied: 'Postulée',
    archived: 'Archivée',
  },
  expired: 'Expirée',
  artifactLabelByArtifact: {
    research: 'Recherche',
    letter: 'Lettre',
    interview_brief: 'Fiche d’entretien',
    visualization: 'Visualisation',
  },
  formatDate: (date: Date) => DATE_FORMAT.format(date),
  missingDate: 'Non précisée',
};

import type { COMMON_EN } from '#/domain/catalogue/en/common.ts';

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
  date: '{{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
  missingDate: 'Non précisée',
  localeSwitcherLabel: 'Langue',
  localeLabelByLocale: {
    fr: 'Français',
    en: 'Anglais',
  },
};

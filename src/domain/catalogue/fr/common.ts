import type { COMMON_EN } from '#/domain/catalogue/en/common.ts';

export const COMMON_FR: typeof COMMON_EN = {
  statusLabelByStatus: {
    new: 'Nouvelle',
    to_apply: 'À traiter',
    applied: 'Postulée',
    invited: 'Convoquée',
    interviewed: 'Entretien passé',
    hired: 'Poste obtenu',
    rejected: 'Refusée',
  },
  archived: 'Archivée',
  stepArchived: '{{stepLabel}} · archivée',
  // cspell:ignore Dépubliée
  unpublished: 'Dépubliée',
  expired: 'Expirée',
  artifactLabelByArtifact: {
    research: 'Recherche',
    letter: 'Lettre',
    portrait: 'Portrait',
    interview_brief: 'Fiche d’entretien',
  },
  date: '{{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
  dateTime: '{{date, datetime(dateStyle: medium; timeStyle: short; timeZone: Europe/Paris)}}',
  missingDate: 'Non précisée',
  close: 'Fermer',
  localeSwitcherLabel: 'Langue',
  localeLabelByLocale: {
    fr: 'Français',
    en: 'Anglais',
  },
};

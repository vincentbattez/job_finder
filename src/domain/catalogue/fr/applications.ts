import type { APPLICATIONS_EN } from '#/domain/catalogue/en/applications.ts';

export const APPLICATIONS_FR: typeof APPLICATIONS_EN = {
  pageTitle: 'Candidatures · Job Finder',
  heading: 'Candidatures de {{candidateName}}',
  noCandidateHeading: 'Qui consulte ses Candidatures ?',
  headingBySection: {
    in_progress: 'En cours',
    hired: 'Postes obtenus',
    rejected: 'Refusées',
    archived: 'Archivées',
    archived_without_application: 'Archivées sans Candidature',
  },
  emptyTextBySection: {
    in_progress: 'Aucune Candidature en cours.',
    hired: 'Aucun Poste obtenu.',
    rejected: 'Aucune Candidature Refusée.',
    archived: 'Aucune Candidature Archivée.',
    archived_without_application: 'Aucune Offre archivée sans Candidature.',
  },
};

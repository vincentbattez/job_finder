import type { POSTING_LIST_EN } from '#/domain/catalogue/en/posting-list.ts';

export const POSTING_LIST_FR: typeof POSTING_LIST_EN = {
  pageTitle: 'Offres · Job Finder',
  heading: 'Offres de {{candidateName}}',
  noCandidateHeading: 'Qui consulte ses Offres ?',
  noCandidateHint: 'Choisissez votre nom en tête du menu. Le front s’en souviendra.',
  noPosting: 'Aucune Offre pour l’instant. Chaque Détection ajoute ici les nouvelles Offres de vos Veilles.',
  noFilteredPosting: 'Aucune Offre ne répond à ces filtres.',
  postingColumn: 'Offre',
  statusColumn: 'Statut',
  publishedAtColumn: 'Publiée le',
  newMark: 'Nouvelle',
  deadlineColumn: 'Date limite',
};

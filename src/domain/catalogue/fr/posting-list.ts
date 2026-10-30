import type { POSTING_LIST_EN } from '#/domain/catalogue/en/posting-list.ts';

export const POSTING_LIST_FR: typeof POSTING_LIST_EN = {
  pageTitle: 'Offres · Job Finder',
  heading: (candidateName: string) => `Offres de ${candidateName}`,
  noCandidateHeading: 'Qui consulte ses Offres ?',
  noCandidateHint: 'Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra.',
  noPosting: 'Aucune Offre pour l’instant. Chaque Détection ajoute ici les nouvelles Offres de vos Veilles.',
  noFilteredPosting: 'Aucune Offre ne répond à ces filtres.',
  postingColumn: 'Offre',
  statusColumn: 'Statut',
  publishedAtColumn: 'Publiée le',
  deadlineColumn: 'Date limite',
};

import type { SHELL_EN } from '#/domain/catalogue/en/shell.ts';

export const SHELL_FR: typeof SHELL_EN = {
  navigationLabel: 'Pages',
  newCount_one: '{{count}} Offre à trier',
  newCount_other: '{{count}} Offres à trier',
  link: {
    new: 'Nouvelles',
    toApply: 'À traiter',
    applications: 'Candidatures',
    profile: 'Profil',
    watches: 'Veilles',
    settings: 'Réglages',
  },
  sidebar: {
    title: 'Menu',
    description: 'Les pages de Job Finder',
    toggle: 'Replier ou déplier le menu',
  },
  candidate: {
    switcherLabel: 'Changer de Candidat',
    role: 'Candidat',
    noCandidate: 'Choisis un Candidat',
    listLabel: 'Candidats',
    manage: 'Gérer les Candidats',
    switched: 'Tu consultes les Offres de {{candidateName}}.',
  },
  theme: {
    toggle: 'Basculer entre le thème clair et le thème sombre',
  },
  localeSwitched: 'L’interface est en français.',
};

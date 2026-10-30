// The routes of the French front and their English ones, as route patterns: a link Léa saved keeps
// working (#65). A `:param` of the French route goes into the English one.
export const REDIRECT_LIST = [
  { from: 'candidat', to: 'candidate' },
  { from: 'profil', to: 'profile' },
  { from: 'candidats', to: 'candidates' },
  { from: 'consignes', to: 'instructions' },
];

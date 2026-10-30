import { generatePath, matchPath } from 'react-router';

// The Artifacts as the French routes named them, and their English names
const ARTIFACT_RENAME_LIST = [
  { from: 'recherche', to: 'research' },
  { from: 'lettre', to: 'letter' },
  { from: 'fiche_entretien', to: 'interview_brief' },
  { from: 'visualisation', to: 'visualization' },
];

// The routes of the French front and their English ones, as route patterns: a link Léa saved keeps
// working (#65). A `:param` of the French route goes into the English one; an Artifact in a path has
// a route of its own, which ranks before the English route's `:artifact`.
export const REDIRECT_LIST = [
  { from: 'candidat', to: 'candidate' },
  { from: 'profil', to: 'profile' },
  { from: 'candidats', to: 'candidates' },
  { from: 'consignes', to: 'instructions' },
  { from: 'offres/:reference', to: 'postings/:reference' },
  { from: 'offres/:reference/statut', to: 'postings/:reference/status' },
  ...ARTIFACT_RENAME_LIST.flatMap(({ from, to }) => [
    { from: `offres/:reference/${from}/document`, to: `postings/:reference/${to}/document` },
    { from: `offres/:reference/${from}/retenue`, to: `postings/:reference/${to}/chosen` },
  ]),
  { from: 'offres/:reference/visualisation/:number', to: 'postings/:reference/visualization/:number' },
];

// The query parameters of the French filters of the Posting list and their English names: a filter Léa
// saved keeps filtering. Their values are English already, or the Candidate's own (a city, a region).
const QUERY_PARAMETER_RENAME_LIST = [
  { from: 'ville', to: 'city' },
  { from: 'archivees', to: 'archived' },
];

function englishPathOf(pathname: string): string {
  for (const { from, to } of REDIRECT_LIST) {
    const match = matchPath(`/${from}`, pathname);
    if (match !== null) {
      return generatePath(`/${to}`, match.params);
    }
  }
  return pathname;
}

function englishSearchOf(search: string): string {
  const parameterList = new URLSearchParams(search);
  if (QUERY_PARAMETER_RENAME_LIST.every(({ from }) => !parameterList.has(from))) {
    return search;
  }
  const englishParameterList = new URLSearchParams();
  for (const [name, value] of parameterList) {
    const english = QUERY_PARAMETER_RENAME_LIST.find(({ from }) => from === name)?.to ?? name;
    englishParameterList.append(english, value);
  }
  return `?${englishParameterList.toString()}`;
}

// The English address of a French one, its path and its query; null when it is English already
export function englishUrlOf({ pathname, search }: URL): string | null {
  const englishUrl = englishPathOf(pathname) + englishSearchOf(search);
  return englishUrl === pathname + search ? null : englishUrl;
}

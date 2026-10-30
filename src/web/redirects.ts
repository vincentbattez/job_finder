import { generatePath, matchPath } from 'react-router';

// The routes of the French front and their English ones, as route patterns: a link Léa saved keeps
// working (#65). A `:param` of the French route goes into the English one.
export const REDIRECT_LIST = [
  { from: 'candidat', to: 'candidate' },
  { from: 'profil', to: 'profile' },
  { from: 'candidats', to: 'candidates' },
  { from: 'consignes', to: 'instructions' },
  { from: 'offres/:reference', to: 'postings/:reference' },
  { from: 'offres/:reference/statut', to: 'postings/:reference/status' },
  { from: 'offres/:reference/:artefact/document', to: 'postings/:reference/:artefact/document' },
  { from: 'offres/:reference/:artefact/retenue', to: 'postings/:reference/:artefact/retenue' },
  { from: 'offres/:reference/visualisation/:number', to: 'postings/:reference/visualisation/:number' },
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

import { generatePath, matchPath } from 'react-router';

// The pages that moved and where they are now, as route patterns: a link Léa saved keeps working (#65).
// A `:param` of the old route goes into the new one. Only pages have an entry: a form posts to its route,
// and no link leads there. The Visualization lost its redirect: it went away (ADR-0020). The Candidates
// page became a section of the Settings (#155), and so did the Instructions page (#149). The list of
// every Posting gave way to To Apply, which reads the same filters (#156).
export const REDIRECT_LIST = [
  { from: 'postings', to: 'to-apply' },
  { from: 'profil', to: 'profile' },
  { from: 'veilles', to: 'watches' },
  { from: 'candidats', to: 'settings' },
  { from: 'candidates', to: 'settings' },
  { from: 'consignes', to: 'settings' },
  { from: 'instructions', to: 'settings' },
  { from: 'offres/:reference', to: 'postings/:reference' },
];

// The query parameters of the French filters of the Posting list and their English names: a filter Léa
// saved keeps filtering, now New's (`/`). Their values are English already, or the Candidate's own (a city, a region).
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

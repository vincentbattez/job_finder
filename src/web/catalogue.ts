import { useRouteLoaderData } from 'react-router';

import { catalogueOf, localeOf, type Locale } from '#/actions/catalogue.ts';

// What the root loader gives of the Candidate chosen in the menu; undefined when it failed
interface IRootData {
  candidate: { locale: Locale } | null;
}

function useCandidate() {
  return useRouteLoaderData<IRootData>('root')?.candidate;
}

// The copy of the chosen Candidate's locale, French when no one is chosen (src/domain/catalogue/)
export function useCatalogue() {
  return catalogueOf(useCandidate());
}

export function useLocale(): Locale {
  return localeOf(useCandidate());
}

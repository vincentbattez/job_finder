import { catalogueFor } from '#/actions/catalogue.ts';

import { useLocale } from './i18n.tsx';

// The former in-house catalogue, in the locale of the request, for the areas not yet moved to
// i18next (ADR-0012)
export function useCatalogue() {
  return catalogueFor(useLocale());
}

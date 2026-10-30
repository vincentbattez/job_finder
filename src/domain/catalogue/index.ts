import type { Locale } from '#/domain/index.ts';

import { POSTING_EN } from './en/posting.ts';
import { SETTINGS_EN } from './en/settings.ts';
import { POSTING_FR } from './fr/posting.ts';
import { SETTINGS_FR } from './fr/settings.ts';
import { localeOf } from './i18n.ts';

// The former in-house catalogue, for the areas not yet moved to i18next (./i18n.ts, ADR-0012): each
// area leaves it for i18next, and the catalogue goes once empty. An entry that takes values is a
// function.
const EN = {
  posting: POSTING_EN,
  settings: SETTINGS_EN,
};

export type Catalogue = typeof EN;

const CATALOGUE_BY_LOCALE: Record<Locale, Catalogue> = {
  en: EN,
  fr: {
    posting: POSTING_FR,
    settings: SETTINGS_FR,
  },
};

export function catalogueOf(candidate: { locale: Locale } | null | undefined): Catalogue {
  return catalogueFor(localeOf(candidate));
}

// The catalogue of a locale already known, without a Candidate to read it from
export function catalogueFor(locale: Locale): Catalogue {
  return CATALOGUE_BY_LOCALE[locale];
}

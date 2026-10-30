import type { Locale } from '#/domain/index.ts';

import { CLI_EN } from './en/cli.ts';
import { COMMON_EN } from './en/common.ts';
import { ERROR_EN } from './en/error.ts';
import { NOTIFICATION_EN } from './en/notification.ts';
import { POSTING_LIST_EN } from './en/posting-list.ts';
import { POSTING_EN } from './en/posting.ts';
import { SETTINGS_EN } from './en/settings.ts';
import { CLI_FR } from './fr/cli.ts';
import { COMMON_FR } from './fr/common.ts';
import { ERROR_FR } from './fr/error.ts';
import { NOTIFICATION_FR } from './fr/notification.ts';
import { POSTING_LIST_FR } from './fr/posting-list.ts';
import { POSTING_FR } from './fr/posting.ts';
import { SETTINGS_FR } from './fr/settings.ts';

// Every word a Candidate reads, in each locale, with no i18n library (spec #65). Each area of en/
// gives its shape to the same area of fr/, typed by it: a key missing on either side fails the
// typecheck. An entry that takes values is a function.
const EN = {
  common: COMMON_EN,
  postingList: POSTING_LIST_EN,
  posting: POSTING_EN,
  settings: SETTINGS_EN,
  cli: CLI_EN,
  error: ERROR_EN,
  notification: NOTIFICATION_EN,
};

export type Catalogue = typeof EN;

const CATALOGUE_BY_LOCALE: Record<Locale, Catalogue> = {
  en: EN,
  fr: {
    common: COMMON_FR,
    postingList: POSTING_LIST_FR,
    posting: POSTING_FR,
    settings: SETTINGS_FR,
    cli: CLI_FR,
    error: ERROR_FR,
    notification: NOTIFICATION_FR,
  },
};

// Léa's: what a Candidate reads unless created with another locale
export const DEFAULT_LOCALE: Locale = 'fr';

// One rule for every entry point: the locale of the Candidate the page, the command or the message is
// for, French when there is none, as for jf help
export function localeOf(candidate: { locale: Locale } | null | undefined): Locale {
  return candidate?.locale ?? DEFAULT_LOCALE;
}

export function catalogueOf(candidate: { locale: Locale } | null | undefined): Catalogue {
  return CATALOGUE_BY_LOCALE[localeOf(candidate)];
}

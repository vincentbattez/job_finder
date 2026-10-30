import { createInstance, type i18n } from 'i18next';

import type { Locale } from '#/domain/index.ts';

import { COMMON_EN } from './en/common.ts';
import { POSTING_LIST_EN } from './en/posting-list.ts';
import { COMMON_FR } from './fr/common.ts';
import { POSTING_LIST_FR } from './fr/posting-list.ts';

// Every word a Candidate reads, one i18next namespace per area (ADR-0012). The areas of en/ give their
// shape to those of fr/: a key missing on either side fails the typecheck.
const EN = {
  common: COMMON_EN,
  postingList: POSTING_LIST_EN,
};

type Resources = typeof EN;

const RESOURCES_BY_LOCALE: Record<Locale, Resources> = {
  en: EN,
  fr: {
    common: COMMON_FR,
    postingList: POSTING_LIST_FR,
  },
};

// The t function checks its keys against the en resources
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Resources;
  }
}

// Léa's: what a Candidate reads unless they chose otherwise
export const DEFAULT_LOCALE: Locale = 'fr';

// One instance per locale, its language fixed: the server renders the requests of both locales at once,
// and nothing ever changes the language of an instance
function createI18n(locale: Locale): i18n {
  const instance = createInstance({
    lng: locale,
    resources: { [locale]: RESOURCES_BY_LOCALE[locale] },
    defaultNS: 'common',
    fallbackLng: false,
    // The resources are bundled: ready on return, so the first render, on the server too, is translated
    initAsync: false,
    // React escapes what it renders, and the CLI and the notifications are plain text
    interpolation: { escapeValue: false },
  });
  void instance.init();
  return instance;
}

const I18N_BY_LOCALE: Record<Locale, i18n> = { fr: createI18n('fr'), en: createI18n('en') };

// The one rule of every entry point: the locale of the Candidate the page, the command or the message
// is for; without one, the locale the visitor chose (the front's cookie), else French
export function localeOf(candidate: { locale: Locale } | null | undefined, chosenLocale: Locale | null = null): Locale {
  return candidate?.locale ?? chosenLocale ?? DEFAULT_LOCALE;
}

// The instance the front renders a locale with (react-i18next's I18nextProvider)
export function i18nOf(locale: Locale): i18n {
  return I18N_BY_LOCALE[locale];
}

// The t function of an area in a locale, out of React: a route's meta, a loader, an action, the CLI, a
// notification
export function tFor<Namespace extends keyof Resources>(locale: Locale, namespace: Namespace) {
  return I18N_BY_LOCALE[locale].getFixedT(locale, namespace);
}

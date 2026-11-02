import { createInstance, type FlatNamespace, type i18n, type ParseKeys, type ResourceNamespaceMap } from 'i18next';

import { LOCALE_LIST, type Locale } from '#/domain/locale.ts';

import { APPLICATIONS_EN } from './en/applications.ts';
import { CLI_EN } from './en/cli.ts';
import { COMMON_EN } from './en/common.ts';
import { DEFAULT_INSTRUCTIONS_EN } from './en/default-instructions.ts';
import { ERROR_EN } from './en/error.ts';
import { HOME_EN } from './en/home.ts';
import { MDX_EN } from './en/mdx.ts';
import { NOTIFICATION_EN } from './en/notification.ts';
import { POSTING_LIST_EN } from './en/posting-list.ts';
import { POSTING_EN } from './en/posting.ts';
import { SETTINGS_EN } from './en/settings.ts';
import { SHELL_EN } from './en/shell.ts';
import { APPLICATIONS_FR } from './fr/applications.ts';
import { CLI_FR } from './fr/cli.ts';
import { COMMON_FR } from './fr/common.ts';
import { DEFAULT_INSTRUCTIONS_FR } from './fr/default-instructions.ts';
import { ERROR_FR } from './fr/error.ts';
import { HOME_FR } from './fr/home.ts';
import { MDX_FR } from './fr/mdx.ts';
import { NOTIFICATION_FR } from './fr/notification.ts';
import { POSTING_LIST_FR } from './fr/posting-list.ts';
import { POSTING_FR } from './fr/posting.ts';
import { SETTINGS_FR } from './fr/settings.ts';
import { SHELL_FR } from './fr/shell.ts';

// Every word a Candidate reads, one i18next namespace per area (ADR-0012). The areas of en/ give their
// shape to those of fr/: a key missing on either side fails the typecheck.
const EN = {
  common: COMMON_EN,
  home: HOME_EN,
  applications: APPLICATIONS_EN,
  postingList: POSTING_LIST_EN,
  cli: CLI_EN,
  error: ERROR_EN,
  notification: NOTIFICATION_EN,
  defaultInstructions: DEFAULT_INSTRUCTIONS_EN,
  posting: POSTING_EN,
  settings: SETTINGS_EN,
  shell: SHELL_EN,
  mdx: MDX_EN,
};

type Resources = typeof EN;

const RESOURCES_BY_LOCALE: Record<Locale, Resources> = {
  en: EN,
  fr: {
    common: COMMON_FR,
    home: HOME_FR,
    applications: APPLICATIONS_FR,
    postingList: POSTING_LIST_FR,
    cli: CLI_FR,
    error: ERROR_FR,
    notification: NOTIFICATION_FR,
    defaultInstructions: DEFAULT_INSTRUCTIONS_FR,
    posting: POSTING_FR,
    settings: SETTINGS_FR,
    shell: SHELL_FR,
    mdx: MDX_FR,
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

// Created on first use, from the one list of the Locales
const I18N_BY_LOCALE = new Map<Locale, i18n>();

// The one rule of every entry point: the locale of the Candidate the page, the command or the message
// is for; without one, the locale the visitor chose (the front's cookie), else French
export function localeOf(candidate: { locale: Locale } | null | undefined, chosenLocale: Locale | null = null): Locale {
  return candidate?.locale ?? chosenLocale ?? DEFAULT_LOCALE;
}

// The instance the front renders a locale with (react-i18next's I18nextProvider)
export function i18nOf(locale: Locale): i18n {
  const existingInstance = I18N_BY_LOCALE.get(locale);
  if (existingInstance !== undefined) {
    return existingInstance;
  }
  const instance = createI18n(locale);
  I18N_BY_LOCALE.set(locale, instance);
  return instance;
}

// The t function of an area in a locale, out of React: a route's meta, a loader, an action, the CLI, a
// notification. A module's own namespace counts too, once it added its resources.
export function tFor<Namespace extends FlatNamespace>(locale: Locale, namespace: Namespace) {
  return i18nOf(locale).getFixedT(locale, namespace);
}

export type ErrorTranslator = ReturnType<typeof tFor<'error'>>;

// The error messages raised before any Candidate is known, or about what every Candidate shares
export function defaultErrorTranslator(): ErrorTranslator {
  return tFor(DEFAULT_LOCALE, 'error');
}

type ModuleNamespace = Extract<keyof ResourceNamespaceMap, string>;

// A module's copy stays in its folder, the only place allowed to name it (ADR-0010): the module adds
// it as a namespace of its own when loaded, and types it by augmenting i18next's ResourceNamespaceMap
export function addResources<Namespace extends ModuleNamespace>(
  namespace: Namespace,
  resourceByLocale: Record<Locale, ResourceNamespaceMap[Namespace]>,
): void {
  for (const locale of LOCALE_LIST) {
    i18nOf(locale).addResourceBundle(locale, namespace, resourceByLocale[locale]);
  }
}

// A text of a module that crosses to the front as data, such as a Parameter's label: the key of its
// own namespace, checked here, where the module declares it
export function textKeyOf<Namespace extends ModuleNamespace>(
  namespace: Namespace,
  key: Extract<ParseKeys<Namespace>, string>,
): string {
  return `${namespace}:${key}`;
}

// The text such a key names, in a locale; the key itself if no module added it
export function textOf(locale: Locale, textKey: string): string {
  return i18nOf(locale).t(textKey, { defaultValue: textKey });
}

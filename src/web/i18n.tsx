import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { useRouteLoaderData } from 'react-router';

import { DEFAULT_LOCALE, i18nOf, type Locale } from '#/actions/i18n.ts';

// The locale the root loader resolved for the request (candidate.server.ts); French when the root
// loader itself failed
export function useLocale(): Locale {
  return useRouteLoaderData<{ locale: Locale }>('root')?.locale ?? DEFAULT_LOCALE;
}

// The server renders in the request's locale, and the client hydrates in the same one: no flash of the
// other locale. A component then translates with react-i18next's useTranslation (ADR-0012).
export function LocaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <I18nextProvider i18n={i18nOf(useLocale())}>{children}</I18nextProvider>;
}

import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { LOCALE_LIST } from '#/actions/i18n.ts';
import { useLocale } from '#/web/i18n.tsx';

import './locale-switcher.css';

// The Locale Switcher (GLOSSARY.md): each button shows its locale's code and is named in the current
// locale (ADR-0012). A plain form, so it also works before React hydrates the page; a refusal shows
// beside it.
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const currentLocale = useLocale();
  const fetcher = useFetcher<{ error?: string } | null>();
  return (
    <fetcher.Form method="post" action="/locale" className="locale-switcher" aria-label={t('localeSwitcherLabel')}>
      {LOCALE_LIST.map((locale) => (
        <button
          className="locale-switcher__option"
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          aria-label={t(`localeLabelByLocale.${locale}`)}
          aria-pressed={locale === currentLocale}
        >
          {locale.toUpperCase()}
        </button>
      ))}
      {fetcher.data?.error !== undefined && <p role="alert">{fetcher.data.error}</p>}
    </fetcher.Form>
  );
}

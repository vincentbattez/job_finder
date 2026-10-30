import { useTranslation } from 'react-i18next';
import { Form } from 'react-router';

import { LOCALE_LIST } from '#/actions/i18n.ts';
import { useLocale } from '#/web/i18n.tsx';

import './locale-switcher.css';

// The Locale Switcher (GLOSSARY.md): each button shows its locale's code and is named in the current
// locale (ADR-0012). A plain form, so it also works before React hydrates the page.
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const currentLocale = useLocale();
  return (
    <Form method="post" action="/locale" className="locale-switcher" aria-label={t('localeSwitcherLabel')}>
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
    </Form>
  );
}

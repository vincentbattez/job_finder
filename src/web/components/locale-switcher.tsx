import { useTranslation } from 'react-i18next';

import { LOCALE_LIST } from '#/actions/i18n.ts';
import { useLocale } from '#/web/i18n.tsx';

import './locale-switcher.css';

// The Locale Switcher (GLOSSARY.md): each button shows its locale's code and is named in the current
// locale (ADR-0012), inside the form of its Container; a refusal shows beside it
export function LocaleSwitcher({ error }: Readonly<{ error: string | null | undefined }>) {
  const { t } = useTranslation();
  const currentLocale = useLocale();
  return (
    <div className="locale-switcher">
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
      {error !== undefined && <p role="alert">{error}</p>}
    </div>
  );
}

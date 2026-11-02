import { useTranslation } from 'react-i18next';

import { LOCALE_LIST, type Locale } from '#/actions/i18n.ts';
import { Button } from '#/web/components/ui/button.tsx';
import { useLocale } from '#/web/i18n.tsx';

// The Locale Switcher (GLOSSARY.md), at the foot of the Sidebar beside the theme toggle (DESIGN.md
// « Navigation (Sidebar) »): each button shows its locale's code and is named in the current locale
// (ADR-0012), inside the form of its Container
export function LocaleSwitcher({ pendingLocale }: Readonly<{ pendingLocale: Locale | null }>) {
  const { t } = useTranslation();
  const currentLocale = useLocale();
  return (
    <div className="flex gap-1 group-data-[collapsible=icon]:flex-col">
      {LOCALE_LIST.map((locale) => (
        <Button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          variant={locale === currentLocale ? 'secondary' : 'ghost'}
          size="icon-sm"
          className="text-label"
          isPending={locale === pendingLocale}
          aria-label={t(`localeLabelByLocale.${locale}`)}
          aria-pressed={locale === currentLocale}
        >
          {locale === pendingLocale ? null : locale.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

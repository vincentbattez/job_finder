import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { LOCALE_LIST } from '#/actions/i18n.ts';
import { LocaleSwitcher as LocaleSwitcherView } from '#/web/components/locale-switcher.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

// The switch posts to /locale, which saves the Locale and brings back the same page, translated
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const fetcher = useFetcher<IRefusal | null>();
  useFeedback(fetcher, () => t('localeSwitched', { ns: 'shell' }));
  return (
    <fetcher.Form method="post" action="/locale" aria-label={t('localeSwitcherLabel')}>
      <LocaleSwitcherView
        pendingLocale={
          fetcher.state === 'idle'
            ? null
            : (LOCALE_LIST.find((locale) => locale === fetcher.formData?.get('locale')) ?? null)
        }
      />
    </fetcher.Form>
  );
}

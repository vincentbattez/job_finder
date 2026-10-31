import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { LocaleSwitcher as LocaleSwitcherView } from '#/web/components/locale-switcher.tsx';
import type { IRefusal } from '#/web/failure.ts';

// A plain form, so the switch also works before React hydrates the page
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const fetcher = useFetcher<IRefusal | null>();
  return (
    <fetcher.Form method="post" action="/locale" aria-label={t('localeSwitcherLabel')}>
      <LocaleSwitcherView error={fetcher.data?.error} />
    </fetcher.Form>
  );
}

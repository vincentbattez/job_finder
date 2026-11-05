import { useTranslation } from 'react-i18next';

// A date of a list row, without its year when it is the current one
export function useShortDate(now: Date) {
  const { t } = useTranslation('lists');
  return (date: Date) =>
    date.getUTCFullYear() === now.getUTCFullYear() ? t('shortDate', { date }) : t('shortDateWithYear', { date });
}

import { useTranslation } from 'react-i18next';

import './date.css';

export function DateText({ date }: Readonly<{ date: Date | null }>) {
  const { t } = useTranslation();
  return date === null ? (
    <span className="date" data-missing>
      {t('missingDate')}
    </span>
  ) : (
    <time dateTime={date.toISOString()}>{t('date', { date })}</time>
  );
}

import { useTranslation } from 'react-i18next';

import './ical-button.css';

// The download of the iCal file of an Interview, a plain link that works without JavaScript; the
// Posting page and the Application rows share it
export function IcalButton({ reference, number }: Readonly<{ reference: string; number: number }>) {
  const { t } = useTranslation('posting');
  return (
    <a
      className="button ical-button"
      href={`/postings/${encodeURIComponent(reference)}/interviews/${String(number)}/ical`}
      download
    >
      {t('interviews.ical')}
    </a>
  );
}

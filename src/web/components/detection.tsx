import { useTranslation } from 'react-i18next';
import { Link, useFetcher } from 'react-router';

import { useIsHydrated } from './use-is-hydrated.ts';

// The shape of the detect action, per Watch
interface IDetection {
  watchId: string;
  isFirstLaunch: boolean;
  newPostingList: { reference: string; title: string }[];
  notificationFailureList: string[];
}

// Runs a Detection without waiting for the daily one, then says what it found for each Watch; the
// list of Postings below reloads with the new ones
export function Detection() {
  const fetcher = useFetcher<{ detectionList: IDetection[]; error: string | null }>();
  const isHydrated = useIsHydrated();
  const isRunning = fetcher.state !== 'idle';
  const { t } = useTranslation('posting');
  return (
    <fetcher.Form method="post" action="/detect" className="detection">
      <button type="submit" disabled={!isHydrated || isRunning}>
        {isRunning ? t('detectionRunning') : t('runDetection')}
      </button>
      <div role="status">
        {fetcher.data?.error != null && <p className="detection__error">{fetcher.data.error}</p>}
        {fetcher.data?.detectionList.map((detection) => (
          <div key={detection.watchId}>
            <p>
              {t(detection.isFirstLaunch ? 'firstLaunchDetectionSummary' : 'detectionSummary', {
                watchId: detection.watchId,
                count: detection.newPostingList.length,
              })}
            </p>
            {detection.newPostingList.length > 0 && (
              <ul>
                {detection.newPostingList.map(({ reference, title }) => (
                  <li key={reference}>
                    <Link to={`/postings/${reference}`}>{title}</Link>
                  </li>
                ))}
              </ul>
            )}
            {detection.notificationFailureList.map((failure) => (
              <p key={failure} className="detection__error">
                {failure}
              </p>
            ))}
          </div>
        ))}
      </div>
    </fetcher.Form>
  );
}

import { useRef, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { Detection as DetectionView } from '#/web/components/detection.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import { useRevalidateWhile } from './use-revalidate-while.ts';

// Runs a Detection of the Candidate's Watches without waiting for the daily one; while any Detection
// runs, the page reads it again
export function Detection({ overview }: Readonly<Pick<ComponentProps<typeof DetectionView>, 'overview'>>) {
  const fetcher = useFetcher<IRefusal>();
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('posting');
  const panelReference = useRef<HTMLDivElement>(null);
  useRevalidateWhile(overview.running !== null);
  return (
    <DetectionView
      ref={panelReference}
      overview={overview}
      isStarting={fetcher.state !== 'idle'}
      error={fetcher.data?.error}
      runForm={
        <fetcher.Form
          method="post"
          action="/detect"
          onSubmit={() => {
            panelReference.current?.focus();
          }}
        >
          <button className="button button--primary" type="submit" disabled={!isHydrated}>
            {overview.last?.error == null ? t('detection.run') : t('detection.runAgain')}
          </button>
        </fetcher.Form>
      }
    />
  );
}

import { RadarIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { DetectionCard, type DetectionOverview } from '#/web/components/detection-card.tsx';
import { HeaderActionLabel } from '#/web/components/page-header.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// The button in the header and the Card under it follow one mutation
const START_FETCHER_KEY = 'detection-start';
const CLOSED_DETECTION_KEY = 'closed-detection';

// Runs a Detection of the Candidate's Watches without waiting for the daily one (ADR-0014). A running
// one disables it; a page left open meanwhile is refused, in a toast telling when that one started.
export function DetectionStart({ running }: Readonly<Pick<DetectionOverview, 'running'>>) {
  const fetcher = useFetcher<IRefusal>({ key: START_FETCHER_KEY });
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('lists');
  useFeedback(fetcher, () => t('detection.started'));
  const isRunning = running !== null;
  return (
    <fetcher.Form method="post" action="/detect">
      <Button type="submit" size="sm" disabled={!isHydrated} isPending={isRunning || fetcher.state !== 'idle'}>
        <RadarIcon aria-hidden />
        <HeaderActionLabel>{isRunning ? t('detection.running') : t('detection.start')}</HeaderActionLabel>
      </Button>
    </fetcher.Form>
  );
}

function readClosedDetection(): string | null {
  try {
    return localStorage.getItem(CLOSED_DETECTION_KEY);
  } catch {
    return null;
  }
}

function subscribeToClosedDetection(onChange: () => void): () => void {
  globalThis.addEventListener('storage', onChange);
  return () => {
    globalThis.removeEventListener('storage', onChange);
  };
}

function closeDetection(startedAt: Date): void {
  try {
    localStorage.setItem(CLOSED_DETECTION_KEY, startedAt.toISOString());
  } catch {
    // Without storage, the verdict stays
  }
  globalThis.dispatchEvent(new Event('storage'));
}

// The Card of the Detection: while any runs, the page reads it again; the verdict closed stays closed in
// this browser, so the server, which cannot tell, leaves it to the first render in the browser
export function DetectionFollow({ overview }: Readonly<{ overview: DetectionOverview }>) {
  const fetcher = useFetcher<IRefusal>({ key: START_FETCHER_KEY });
  const closedDetection = useSyncExternalStore(subscribeToClosedDetection, readClosedDetection, () => null);
  const isHydrated = useIsHydrated();
  useRevalidateWhile(overview.running !== null);
  const { last } = overview;
  return (
    <DetectionCard
      overview={overview}
      isStarting={fetcher.state !== 'idle'}
      isLastClosed={!isHydrated || (last !== null && closedDetection === last.startedAt.toISOString())}
      onCloseLast={() => {
        if (last !== null) {
          closeDetection(last.startedAt);
        }
      }}
    />
  );
}

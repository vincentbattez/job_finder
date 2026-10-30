import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { StateBadge, type State } from './badge.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// The worker runs the extraction in its own process (ADR-0003), so its state is read again until done
export function ExtractionLaunch({
  reference,
  state,
  log,
}: Readonly<{ reference: string; state: State; log: string }>) {
  const fetcher = useFetcher<{ error: string | null }>();
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  const labelId = useId();
  useRevalidateWhile(state === 'in_progress');
  return (
    <fetcher.Form method="post" action="/run" className="module-launch" aria-labelledby={labelId}>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value="extraction" />
      <span id={labelId}>{t('extractionLabel')}</span>
      <span role="status">
        <StateBadge state={state} />
      </span>
      {state === 'failed' && (
        <>
          <button type="submit" disabled={!isHydrated || fetcher.state !== 'idle'}>
            {t('relaunchExtraction')}
          </button>
          <p className="module-launch__refusal">{log}</p>
        </>
      )}
      {fetcher.data?.error != null && <p role="alert">{fetcher.data.error}</p>}
    </fetcher.Form>
  );
}

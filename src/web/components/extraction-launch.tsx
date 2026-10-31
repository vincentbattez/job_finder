import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { ErrorCode } from '#/actions/index.ts';
import { isPending } from '#/actions/state.ts';
import type { IRefusal } from '#/web/failure.ts';

import { StateBadge, type State } from './badge.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';
import { WorkerTask } from './worker-task.tsx';

// The worker runs the extraction in its own process (ADR-0003), so its state is read again until done,
// and the page says when no worker moves it
export function ExtractionLaunch({
  reference,
  state,
  log,
  workerFailure,
}: Readonly<{
  reference: string;
  state: State;
  log: string;
  // Why its job makes no progress: the worker is stopped or stuck
  workerFailure: { errorCode: ErrorCode; message: string } | null;
}>) {
  const fetcher = useFetcher<IRefusal>();
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  const labelId = useId();
  const isRunning = isPending(state);
  useRevalidateWhile(isRunning);
  return (
    <fetcher.Form method="post" action="/run" aria-labelledby={labelId}>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value="extraction" />
      <WorkerTask refusal={state === 'failed' ? log : null} error={fetcher.data?.error ?? workerFailure?.message}>
        <span id={labelId}>{t('extractionLabel')}</span>
        <span role="status">
          <StateBadge state={state} />
        </span>
        {state === 'failed' && (
          <button className="button button--primary" type="submit" disabled={!isHydrated || fetcher.state !== 'idle'}>
            {t('relaunchExtraction')}
          </button>
        )}
      </WorkerTask>
    </fetcher.Form>
  );
}

import { RefreshCwIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { ErrorCode } from '#/actions/index.ts';
import { isPending, type State } from '#/actions/state.ts';
import { StateBadge } from '#/web/components/state-badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import { useRevalidateWhile } from './use-revalidate-while.ts';

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
  const error = fetcher.data?.error ?? workerFailure?.message;
  useRevalidateWhile(isRunning);
  return (
    <fetcher.Form method="post" action="/run" aria-labelledby={labelId} className="grid gap-2">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="module" value="extraction" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span id={labelId} className="text-muted-foreground">
          {t('extractionLabel')}
        </span>
        <span role="status">
          <StateBadge state={state} />
        </span>
        {state === 'failed' && (
          <Button type="submit" variant="outline" size="sm" disabled={!isHydrated} isPending={fetcher.state !== 'idle'}>
            <RefreshCwIcon />
            {t('relaunchExtraction')}
          </Button>
        )}
      </div>
      {state === 'failed' && <p className="text-sm text-destructive">{log}</p>}
      {error != null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fetcher.Form>
  );
}

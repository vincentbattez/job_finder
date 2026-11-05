import { cn } from 'cn';
import { useTranslation } from 'react-i18next';

import type { State } from '#/actions/state.ts';
import { Badge } from '#/web/components/ui/badge.tsx';

// What the worker made of a task (ADR-0003), in the tones of an Artifact's Version: failed in red, ready
// in green, running in amber, and neutral while nothing has started (DESIGN.md « State hues »)
const TONE_BY_STATE: Record<State, string> = {
  absent: 'text-muted-foreground',
  queued: 'text-muted-foreground',
  in_progress: 'text-pending-foreground',
  ready: 'border-transparent bg-validated/10 text-validated-foreground',
  failed: 'border-destructive/40 text-destructive',
};

export function StateBadge({ state }: Readonly<{ state: State }>) {
  const { t } = useTranslation('posting');
  return (
    <Badge variant="outline" data-state={state} className={cn(TONE_BY_STATE[state])}>
      {t(`stateLabelByState.${state}`)}
    </Badge>
  );
}

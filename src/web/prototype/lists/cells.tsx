// PROTOTYPE. The small pieces every variant composes its rows from: the Step badge, the Deadline with
// its countdown, the Research / Letter states, the Repost mark, Garder / Écarter.
import { CheckIcon, Loader2Icon, RepeatIcon, XIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/prototype/components/ui/tooltip.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import {
  ARTIFACT_STATE_LABEL,
  daysUntil,
  formatCountdown,
  formatDate,
  STEP_LABEL,
  type ArtifactState,
  type IPosting,
  type Step,
} from '../model.ts';
import { useListController } from './list-context.tsx';
import { formatShortDate, ordinal, STEP_TONE, URGENCY_TONE, urgencyOf } from './list-model.ts';

export function StepBadge({ step, className }: { step: Step; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('gap-1.5 border-0', STEP_TONE[step].badge, className)}>
      <span className={cn('size-1.5 rounded-full', STEP_TONE[step].dot)} />
      {STEP_LABEL[step]}
    </Badge>
  );
}

// « 20 nov. » then « dans 18 j », red within 7 days, struck once passed
export function DeadlineCell({
  deadline,
  layout = 'stack',
  className,
}: {
  deadline: string | null;
  layout?: 'stack' | 'inline';
  className?: string;
}) {
  if (deadline === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const urgency = urgencyOf(deadline);
  return (
    <span
      className={cn('flex tabular-nums', layout === 'stack' ? 'flex-col' : 'items-baseline gap-1.5', className)}
      title={formatDate(deadline)}
    >
      <span className={cn(urgency === 'passed' && 'text-muted-foreground')}>{formatShortDate(deadline)}</span>
      <span className={cn('text-xs', URGENCY_TONE[urgency].text, urgency === 'soon' && 'font-medium')}>
        {formatCountdown(deadline)}
      </span>
    </span>
  );
}

const ARTIFACT_STATE_CLASS: Record<ArtifactState, string> = {
  none: 'border-dashed text-muted-foreground',
  draft: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  validated: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
};

function ArtifactStateBadge({ label, state, isRunning }: { label: string; state: ArtifactState; isRunning: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn('gap-1 font-normal', ARTIFACT_STATE_CLASS[state])}>
          {isRunning ? (
            <Loader2Icon className="animate-spin" />
          ) : state === 'validated' ? (
            <CheckIcon />
          ) : state === 'draft' ? (
            <span className="size-1.5 rounded-full bg-amber-500" />
          ) : null}
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {label === 'R' ? 'Recherche' : 'Lettre'} · {isRunning ? 'génération en cours' : ARTIFACT_STATE_LABEL[state]}
      </TooltipContent>
    </Tooltip>
  );
}

// « R ✓ · L • »: the Research and the Letter at a glance, with their full state in a tooltip
export function ArtifactStates({
  posting,
  runningKeys = [],
  isCompact = true,
}: {
  posting: IPosting;
  runningKeys?: string[];
  isCompact?: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <ArtifactStateBadge
        label={isCompact ? 'R' : 'Recherche'}
        state={posting.research.state}
        isRunning={runningKeys.includes('research')}
      />
      <ArtifactStateBadge
        label={isCompact ? 'L' : 'Lettre'}
        state={posting.letter.state}
        isRunning={runningKeys.includes('letter')}
      />
    </span>
  );
}

// The Repost mark: its publication number, the earlier Application in its tooltip
export function RepostMark({ posting, isLabelled = false }: { posting: IPosting; isLabelled?: boolean }) {
  const { publicationNumber, firstPublishedAt, earlierApplication } = posting.repost;
  if (publicationNumber <= 1) {
    return isLabelled ? null : <span className="text-muted-foreground">—</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'gap-1 font-normal text-muted-foreground',
            earlierApplication !== null && 'border-sky-500/40 text-sky-700 dark:text-sky-300',
          )}
        >
          <RepeatIcon />
          {isLabelled ? `Republication · ${ordinal(publicationNumber)}` : ordinal(publicationNumber)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {ordinal(publicationNumber)} publication de ce poste depuis le {formatDate(firstPublishedAt)}
        {earlierApplication === null ? null : (
          <>
            <br />
            Tu as postulé le {formatDate(earlierApplication.appliedAt)} · {STEP_LABEL[earlierApplication.step]}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// Garder / Écarter on a New row; the row slides out while the store answers
export function SortButtons({
  reference,
  size = 'row',
  className,
}: {
  reference: string;
  size?: 'row' | 'icon' | 'card';
  className?: string;
}) {
  const { sort, leavingReferences } = useListController();
  const isLeaving = leavingReferences.has(reference);
  function onSort(event: MouseEvent, decision: 'keep' | 'dismiss') {
    event.stopPropagation();
    void sort(reference, decision);
  }
  if (size === 'icon') {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={isLeaving}
              onClick={(event) => onSort(event, 'dismiss')}
              aria-label="Écarter"
            >
              <XIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Écarter</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" disabled={isLeaving} onClick={(event) => onSort(event, 'keep')} aria-label="Garder">
              {isLeaving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Garder : passe À traiter et lance sa Recherche</TooltipContent>
        </Tooltip>
      </span>
    );
  }
  const buttonSize = size === 'card' ? 'sm' : 'xs';
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <Button
        size={buttonSize}
        variant="ghost"
        className="text-muted-foreground"
        disabled={isLeaving}
        onClick={(event) => onSort(event, 'dismiss')}
      >
        <XIcon />
        Écarter
      </Button>
      <Button size={buttonSize} variant="outline" disabled={isLeaving} onClick={(event) => onSort(event, 'keep')}>
        {isLeaving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
        Garder
      </Button>
    </span>
  );
}

// The badge of a Posting a Detection just found
export function FoundBadge() {
  return <Badge className="h-4 px-1.5 text-[10px]">Juste trouvée</Badge>;
}

// « dans 3 j » or « il y a 2 j » next to a date, muted
export function Countdown({ iso }: { iso: string | null }) {
  if (iso === null) {
    return null;
  }
  return (
    <span className={cn('text-xs text-muted-foreground', daysUntil(iso) >= 0 && daysUntil(iso) <= 7 && 'font-medium')}>
      {formatCountdown(iso)}
    </span>
  );
}

// The classes of a row in any list: hovered, active, leaving after Garder / Écarter
export function rowStateClass({
  isHovered,
  isActive,
  isLeaving,
  isArchived,
}: {
  isHovered: boolean;
  isActive: boolean;
  isLeaving: boolean;
  isArchived: boolean;
}): string {
  return cn(
    'cursor-pointer scroll-my-16 transition-[background-color,opacity,translate] duration-300',
    isHovered && 'bg-muted/70',
    isActive && 'bg-primary/[0.07] shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/10',
    isLeaving && 'pointer-events-none translate-x-6 opacity-0',
    isArchived && 'text-muted-foreground',
  );
}

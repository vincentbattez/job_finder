// PROTOTYPE. A Posting on two lines, for the narrow lists (variant B's floating panel, the mobile
// bottom sheet): title then the one fact that matters for its list, its actions on the right.
import { cn } from '#/web/prototype/lib/utils.ts';

import { formatDateTime, type IPosting } from '../model.ts';
import {
  ArtifactStates,
  Countdown,
  DeadlineCell,
  FoundBadge,
  RepostMark,
  rowStateClass,
  SortButtons,
  StepBadge,
} from './cells.tsx';
import { useListController, useRowSync } from './list-context.tsx';
import { formatShortDate, upcomingInterviewOf } from './list-model.ts';

function Meta({ posting, runningKeys }: { posting: IPosting; runningKeys: string[] }) {
  const { list } = useListController();
  if (list === 'new') {
    return (
      <>
        <DeadlineCell deadline={posting.deadline} layout="inline" />
        <RepostMark posting={posting} isLabelled />
      </>
    );
  }
  if (list === 'to_apply') {
    return (
      <>
        <DeadlineCell deadline={posting.deadline} layout="inline" />
        <ArtifactStates posting={posting} runningKeys={runningKeys} />
      </>
    );
  }
  const interview = upcomingInterviewOf(posting);
  return (
    <>
      <StepBadge step={posting.step} />
      {interview === null ? (
        <span>Postulée le {formatShortDate(posting.appliedAt)}</span>
      ) : (
        <span className="flex items-baseline gap-1.5">
          Entretien {formatDateTime(interview.startAt)} <Countdown iso={interview.startAt} />
        </span>
      )}
    </>
  );
}

export function CompactRow({ posting, runningKeys }: { posting: IPosting; runningKeys: string[] }) {
  const { list } = useListController();
  const { rowProps, ...state } = useRowSync(posting.reference);
  return (
    <li
      {...rowProps}
      className={cn(
        rowStateClass({ ...state, isArchived: posting.archivedAt !== null }),
        'flex items-center gap-3 px-4 py-3',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          {posting.isSynthetic ? <FoundBadge /> : null}
          <p className="truncate text-sm font-medium" title={posting.title}>
            {posting.title}
          </p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {posting.city ?? '—'}
          {posting.employer === null ? '' : ` · ${posting.employer}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Meta posting={posting} runningKeys={runningKeys} />
        </div>
      </div>
      {list === 'new' && posting.archivedAt === null ? <SortButtons reference={posting.reference} size="icon" /> : null}
    </li>
  );
}

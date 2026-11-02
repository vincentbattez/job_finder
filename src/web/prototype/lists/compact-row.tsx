// PROTOTYPE. A Posting on three short lines, for the narrow lists (variant B's floating panel, the
// mobile bottom sheet): its City first, then its title, then the facts that matter for its list; its
// actions on the right.
import { MapPinIcon } from 'lucide-react';

import { cn } from '#/web/prototype/lib/utils.ts';

import { formatDateTime, nextInterviewOf, type IPosting } from '../model.ts';
import {
  ArtifactStates,
  Countdown,
  DeadlineCell,
  FoundBadge,
  RepostMark,
  rowStateClass,
  SortButtons,
} from './cells.tsx';
import { useRunningKeysByReference } from './columns.tsx';
import { useListController, useRowSync } from './list-context.tsx';
import { formatShortDate, groupPostings } from './list-model.ts';
import { EmptyList } from './variant-a.tsx';

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
  // Invited: the next Interview; Interviewed: the last one
  const interview = nextInterviewOf(posting.interviews);
  return (
    <>
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
        <p className="flex min-w-0 items-center gap-1.5 text-sm">
          <MapPinIcon className="size-3.5 shrink-0 text-primary" />
          <span className="shrink-0 font-semibold">{posting.city ?? 'Lieu inconnu'}</span>
          {posting.employer === null ? null : (
            <span className="truncate text-xs text-muted-foreground">· {posting.employer}</span>
          )}
          {posting.isSynthetic ? <FoundBadge /> : null}
        </p>
        <p className="truncate text-sm text-foreground/85" title={posting.title}>
          {posting.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Meta posting={posting} runningKeys={runningKeys} />
        </div>
      </div>
      {list === 'new' && posting.archivedAt === null ? <SortButtons reference={posting.reference} size="icon" /> : null}
    </li>
  );
}

// The list's Postings in their groups, attention first, each under a sticky header (variant B, mobile)
export function GroupedCompactList() {
  const { list, postings } = useListController();
  const runningKeysByReference = useRunningKeysByReference();
  if (postings.length === 0) {
    return <EmptyList />;
  }
  return groupPostings(list, postings).map((group) => (
    <section key={group.key} aria-label={group.label}>
      <h3 className="sticky top-0 z-10 flex items-baseline gap-2 border-b bg-muted/95 px-4 py-1.5 text-xs font-semibold backdrop-blur">
        {group.label}
        <span className="font-normal text-muted-foreground tabular-nums">{group.postings.length}</span>
        {group.hint === '' ? null : <span className="ml-auto font-normal text-muted-foreground">{group.hint}</span>}
      </h3>
      <ul className="divide-y border-b">
        {group.postings.map((posting) => (
          <CompactRow
            key={posting.reference}
            posting={posting}
            runningKeys={runningKeysByReference.get(posting.reference) ?? []}
          />
        ))}
      </ul>
    </section>
  ));
}
